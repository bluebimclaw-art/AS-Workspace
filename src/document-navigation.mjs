// A dirty document requires a discard decision, never a compulsory save.
export function mayLeaveDocument({unsaved=false,busy=false,confirm=message=>window.confirm(message),notify=()=>{}}={}){
 if(busy){notify('保存或生成操作進行中，請稍後再切換；無需額外保存。');return false;}
 return !unsaved||confirm('目前有未保存的修改。按「確定」放棄修改並離開；按「取消」繼續編輯。已保存版本不受影響。');
}
