import QRCode from 'qrcode';

export const generateQRCode = async (data: string): Promise<string> => {
  try {
    return await QRCode.toDataURL(data);
  } catch (error) {
    throw new Error('Erro ao gerar QR code');
  }
};

export const generateQRCodeBuffer = async (data: string): Promise<Buffer> => {
  try {
    return await QRCode.toBuffer(data);
  } catch (error) {
    throw new Error('Erro ao gerar QR code buffer');
  }
};