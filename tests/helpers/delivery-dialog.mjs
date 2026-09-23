import {mkdtemp} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
export async function configureDeliveryDialog(app){
  const directory=await mkdtemp(path.join(os.tmpdir(),'nodus-test-delivery-'));
  await app.evaluate(({dialog},directory)=>{
    const original=dialog.showOpenDialog.bind(dialog);
    dialog.showOpenDialog=async(...args)=>{
      const options=args.at(-1);
      if(options?.title==='选择作品交付目录')return {canceled:false,filePaths:[directory]};
      return original(...args);
    };
  },directory);
}
