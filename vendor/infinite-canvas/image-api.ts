import {request} from './rpc';
import {imageToDataUrl} from '@/services/image-storage';
import {decodeChannelModel, type AiConfig, type ModelChannel} from '@/stores/use-config-store';
import type {ReferenceImage} from '@/types/image';
export type AiTextMessage={role:'system'|'user'|'assistant';content:any};
type Options={signal?:AbortSignal};
async function generate(config:AiConfig,prompt:string,references:ReferenceImage[],options?:Options){options?.signal?.throwIfAborted();const selected=decodeChannelModel(config.model||config.imageModel);if(!selected)throw Error('請在AS Workspace左下選擇生圖服務及模型');const result=await request('generate',{provider:selected.channelId,model:selected.model,prompt,references:await Promise.all(references.map(r=>imageToDataUrl(r)))});return result.map((dataUrl:string,index:number)=>({id:crypto.randomUUID?.()||String(Date.now())+'-'+index,dataUrl}));}
export function requestGeneration(config:AiConfig,prompt:string,options?:Options){return generate(config,prompt,[],options);}
export function requestEdit(config:AiConfig,prompt:string,references:ReferenceImage[],options?:Options){return generate(config,prompt,references,options);}
export async function requestImageQuestion(_config:AiConfig,_messages:AiTextMessage[],_onDelta?:any,_options?:Options):Promise<string>{throw Error('請使用AS Workspace右側AI助手；畫布內多模態對話尚未驗收。');}
export async function fetchImageModels(_config:any){return [];}
export async function fetchChannelModels(_channel:ModelChannel){return [];}
