export function acceptsGzip(header=''){
 return header.split(',').some(part=>{const [name,...params]=part.trim().toLowerCase().split(';');return name.trim()==='gzip'&&!params.some(p=>/^q\s*=\s*0(?:\.0*)?$/.test(p.trim()));});
}
