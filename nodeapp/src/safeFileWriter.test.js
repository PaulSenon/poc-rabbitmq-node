const FileWriter = require('./safeFileWriter');
const fs = require('fs');
const util = require('util');
const os = require("os");

(async () => {
    try{
        file={
            path: '../mq.save'
        }
        const fwriter = new FileWriter(file.path);
        await fwriter.open();

        // let row = '@1345345@sdgsgk3@dljlkdnslkghldklkjg'
        // const res = await fwriter.extractRowKey(row);
        // console.log(res);

        // for(let i=0; i<20; i++){
        //     await fwriter.addLine(10, `test ${i}`);
        // }

        let res;
        while(res = await fwriter.popLine()){
            console.log("res", res);
        }
        console.log("end");


        // let cs = await fwriter.readChecksum(file);
        // console.log(`cs read: ${cs}`);

        // cs = await fwriter.createChecksum(file);
        // console.log(`cs create: ${cs}`);

        // await fwriter.isValid(file);
        // await fwriter.updateChecksum(file);
        // await fwriter.isValid(file);

        // cs = await fwriter.readChecksum(file);
        // console.log(`cs read: ${cs}`);
        
        await fwriter.close();
    }catch(err){
        console.log("err",err);
    }
})();

// (async () => {
//     const readline = require('readline');

//     const stream = fs.createReadStream('../mq.save');
//     const rl = readline.createInterface({
//         input: stream,
//         crlfDelay: Infinity
//     });

//     rl.write('BONJOUR');
//     let count = -1;
//     for await (const line of rl) {
//         // console.log(line);
//         count ++;
//         // break;
//     }
//     console.log(count);

//     stream.close();
// })();