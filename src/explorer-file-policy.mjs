// Mirrors the existing server DirectorySearch.bytes limit, not an override.
export const MAX_READ_BYTES=32*1024*1024;
export function canReadFile(file){return !!file&&!file.directory&&Number.isFinite(file.bytes)&&file.bytes>=0&&file.bytes<=MAX_READ_BYTES;}
