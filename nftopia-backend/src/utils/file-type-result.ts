import fileType from 'file-type';


export const fileTypeResultFromBuffer =  async (buffer: Buffer) => {
    const fileTypeResult = await fileType.fromBuffer(buffer); 
    return fileTypeResult;
}
