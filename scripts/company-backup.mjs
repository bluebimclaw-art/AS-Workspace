import {backupCompany,restoreCompany} from '../server/company-backup.mjs';
const [action,source,target]=process.argv.slice(2);if(!['backup','restore'].includes(action)||!source||!target)throw Error('用法：npm run company:backup -- backup|restore 來源資料夾 全新目的資料夾（先停止平台）');console.log(JSON.stringify(await(action==='backup'?backupCompany:restoreCompany)(source,target)));
