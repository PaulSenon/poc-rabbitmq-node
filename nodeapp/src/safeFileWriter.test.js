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

        await fwriter.addLine("test 1");
        await fwriter.addLine("test 2");
        await fwriter.addLine("test 3");
        await fwriter.addLine("test 4");
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