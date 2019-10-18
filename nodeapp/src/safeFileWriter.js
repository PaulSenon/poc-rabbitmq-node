const fs = require('fs');
const readline = require('readline');
const os = require('os');
const util = require('util');
const es = require('event-stream');
const tmp = require('tmp');

class asyncMonothreadMutex{
    constructor(){
        this.isLocked = false;
        this.callBackQueue = [];
    }

    async lock(cb){
        console.log("received", cb);
        if(!this.isLocked){
            this.isLocked = true;
            await cb();
        }else{
            this.callBackQueue.push(cb);
        }
    }

    unlock(){
        return new Promise((resolve, reject) => {
            this.isLocked = false;
            !!this.callBackQueue.length && this.lock(this.callBackQueue.shift());
            resolve();
        });
    }
}

class saveFileWriter{

    constructor(filePath){
        this.files = [
            {
                path: filePath,
                fd: undefined,
                stream: undefined,
            },{
                path: `${filePath}.tmp`,
                fd: undefined,
                stream: undefined,
            }
        ];

        this.mutex = new asyncMonothreadMutex();
    }

    /**
     * check if files exist
     * check rights
     * find the file that contain the valid data (not corrupted, not troncated)
     * copy the file to the other one
     */
    open(){
        return new Promise(async (resolve, reject) => {
            try{
                // open files in write mode (create them if they do not exist)
                this.files[0].fd = await this.openFile(this.files[0].path, 'a');
                this.files[1].fd = await this.openFile(this.files[1].path, 'a');
    
                // open streams
                this.files[0].stream = fs.createReadStream(this.files[0].path);
                this.files[1].stream = fs.createReadStream(this.files[1].path);
                
                // ensure the two files are in the same stable state
                await this.setFilesInStableState();
                resolve();
            }catch(err){
                reject(err);
            }
        })
    }

    /**
     * Set files in a consistent state
     * @returns { Promise } => resolve void
     */
    setFilesInStableState(){
        return new Promise(async (resolve, reject) => {
            try{

                const stats1 = fs.statSync(this.files[0].path);
                const stats2 = fs.statSync(this.files[1].path);
                
                // get the most recent
                const i1 = (stats1.mtime >= stats2.mtime) ? 0 : 1;
                const i2 = (i1+1)%2;
    
                // handle case when files have just been created
                if(fs.statSync(this.files[0].path).size === 0
                    && fs.statSync(this.files[0].path).size === 0){
                        await this.updateChecksum(this.files[0]);
                        await this.updateChecksum(this.files[1]);
                }
    
                // check integrity
                if(await this.isValid(this.files[i1])){
                    // copy its content to the other one
                    fs.copyFileSync(this.files[i1].path, this.files[i2].path);
                }else if(await this.isValid(this.files[i2])){
                    // copy its content to the other one
                    fs.copyFileSync(this.files[i2].path, this.files[i1].path);
                }else{
                    reject("All files are corrupted... This is not uspposed to happend. If you have not delete any files, then the script need to be fixed. To run this script anyway");
                }
                resolve();
            }catch(err){
                reject(err);
            }
        });
    }


    addLine(key, data){
        return new Promise((resolve, reject) => {
            // create buffer
            let buffer = JSON.stringify(Buffer.from(data));
            buffer = `@${key}@${buffer}`;

            this.mutex.lock(async () => {
                // write in tmp file first
                fs.writeSync(this.files[1].fd, buffer+""+ os.EOL);
                // update checksum
                await this.updateChecksum(this.files[1]);

                // when successful, recopy data to main file
                fs.copyFileSync(this.files[1].path, this.files[0].path);
                // update checksum
                await this.updateChecksum(this.files[0]);

                this.mutex.unlock();
                resolve();
            });
    
        });
    }

    extractRowKey(row){
        return new Promise((resolve, reject) => {
            let _row = row;
            const regex = /@\d*@/ // @1234@
            let resContent;
            let resIndex;
            _row = _row.replace(regex,(content,index) => {
                resContent = content;
                resIndex = index;
                return '';
            });
            // console.log(row);
            // console.log(resContent);
            // console.log(resIndex);
            // console.log(_row);
            if(resIndex === 0 && !!resContent){
                resolve({
                    key: resContent.substr(1,resContent.length-2),
                    content: _row,
                });
            }else{
                reject(`Fail geting key. Invalid row : [${row}]`);
            }
        });
    }

    popLine(key = undefined){
        return new Promise((resolve, reject) => {
            this.mutex.lock(async () => {

                try{
                    // popline
                    const rawData_Buff_Json = await this.popDataRow(this.files[1], key);    // Data > Buff > Json > (pop)

                    // handle enmpty result
                    if(!rawData_Buff_Json){
                        this.mutex.unlock();
                        return resolve(false);
                    }

                    const rawData_Buff = JSON.parse(rawData_Buff_Json);                     // Data > Buff
                    const rawData = Buffer.from(rawData_Buff).toString();                   // Data

                    // update checksum
                    await this.updateChecksum(this.files[1]);
                    
                    // when successful, recopy data to main file
                    fs.copyFileSync(this.files[1].path, this.files[0].path);
                    // update checksum
                    await this.updateChecksum(this.files[0]);
                    
                    this.mutex.unlock();
                    resolve(rawData);
                }catch(err){
                    this.mutex.unlock();
                    reject(err);
                }
            });
        });
    }

    getSize(file){
        return new Promise(async (resolve, reject) => {
            let actualChecksumSize = 0;
            try{
                actualChecksumSize = (await this.readChecksum(file)).length + os.EOL.length;
            }catch(err){/*no checksum yet*/}

            const fileSize = fs.statSync(file.path).size;
            const sizeWithoutChecksum = fileSize - actualChecksumSize;
            resolve(sizeWithoutChecksum);
        });
    }

    /**
     * the algorithm used to calc checksum
     * 
     * @return {String} checksum string
     */
    //ok
    createChecksum(file){
        return new Promise(async (resolve, reject) => {
            const sizeWithoutChecksum = await this.getSize(file);
            resolve("___CHECKSUM___"+sizeWithoutChecksum+"___CHECKSUM___");
        });
    }

    //ok
    updateChecksum(file){
        return new Promise(async (resolve, reject) => {
            const regex = /___CHECKSUM___.*___CHECKSUM___/g;
            const checksum = await this.createChecksum(file);

            // load the html file
            let content = fs.readFileSync(file.path, 'utf8');

            // replacePath is your match[1]
            if(content.match(regex)){
                content = content.replace(regex, checksum);
            }else{
                content = checksum + os.EOL + content
            }

            // this will overwrite the original html file, change the path for test
            fs.writeFileSync(file.path, content);

            resolve();
        });
    }

    //ok
    isValid(file){
        return new Promise(async (resolve, reject) => {
            try{
                const actualChecksum = await this.readChecksum(file);
                const processedChecksum = await this.createChecksum(file);
                if(actualChecksum === processedChecksum){
                    resolve(true);
                }else{
                    resolve(false);
                }
            }catch(err){
                resolve(false);
            }
        });
    }

    //ok
    readChecksum(file){
        return new Promise((resolve, reject) => {
            const regex = /___CHECKSUM___.*___CHECKSUM___/g;
            const s = fs.createReadStream(file.path, 'utf8')
                .pipe(es.split()) // split the input file into lines
                .pipe(es.map((line, next) => {
                    line.replace(regex, (match, replacePath) => {
                        resolve(match);
                    });
                    next(null, line);
                }));
            s.on('end', () => reject('no checksum'));
        });
    }

    popDataRow(file, _key = undefined){
        return new Promise((resolve, reject) => { try { 
            const tmpFile = tmp.fileSync();
            let count = -1;
            let res;
            let keyAlreadyFound = false;
            const countpp = () => {
                return new Promise((resolve, reject) => {
                    count ++;
                    resolve(count);
                });
            };
            const setRes = (v) => {
                return new Promise((resolve, reject) => {
                    res = v;
                    resolve();
                });
            };
            const s = fs.createReadStream(file.path, 'utf8')
                .pipe(es.split()) // split the input file into lines
                .pipe(es.map(async (line, next, test) => {
                    const count = await countpp();
                    // console.log(count+": "+line);

                    // skip header and empty
                    if(count <= 0){
                        return next(null, line+os.EOL); // same as filter, return data without change
                    }
                    if(line === ""){
                        return next(null, line); // same as filter, return data without change
                    }

                    const { key, content } = await this.extractRowKey(line);
                    
                    // console.log({_key, key, content});
                    if(!!_key && !keyAlreadyFound && key == _key){
                        keyAlreadyFound = true;
                        await setRes(content);
                        // console.log("REMOVE BY ID")
                        return next(null); // same as filter, map to null
    
                    }else if(!_key && count === 1){
                        await setRes(content);
                        // console.log("REMOVE")
                        return next(null); // same as filter, map to null
                    }

                    return next(null, line+os.EOL); // same as filter, return data without change
                }))
                // .pipe(es.mapSync((line, next) => {
                //     console.log(">>>>>", line)
                //     if(line !== ""){
                //         return line + os.EOL;
                //     }
                // }))
                .pipe(fs.createWriteStream(tmpFile.name, 'utf8'))
                .on('finish', () => {
                    // copy tmp to original
                    fs.copyFileSync(tmpFile.name, file.path);
                    // console.log(tmpFile.name)
                    fs.unlinkSync(tmpFile.name);
                    resolve(res);
                });

        }catch(err){ reject(`error in popDataRow(${file.path}, ${_key}): ${err}`) }});
    }

    getNbLines(file){
        return new Promise(async (resolve, reject) => {
            const rl = this.getRl(file);
        
            let count = -1;
            for await (const line of rl) {
                count ++;
            }

            resolve(count);
        });
    }

    getRl(file){
        return readline.createInterface({
            input: file.stream,
            crlfDelay: Infinity
        });
    }

    openFile(filePath, mode = 'w'){
        return new Promise((resolve, reject) => {
            fs.open(filePath, mode, (err, fd) => {
                if(err){
                    // error
                    reject(err);
                }else{
                    // file opened
                    resolve(fd);
                }
            });
        });
    }

    close(){
        return new Promise((resolve, reject) => {
            this.files.forEach(file => {
                try{ fs.closeSync(file.fd) }catch(e){
                    console.log(`warning: closing file descriptor for [${file.path}] failed`);
                }
                try{ file.stream.close() }catch(e){
                    console.log(`warning: closing stream for [${file.path}] failed.`);
                }
            });
            resolve();
        });
    }
}

module.exports = saveFileWriter;
// export default saveFileWriter;