import { FileType } from '@types';

/**
 * Helper function to check if document is a proxy statement
 */
export const isProxyStatement = (formType: string): boolean => {
  const normalizedType = formType?.toUpperCase();
  return normalizedType === 'DEF 14A' || 
         normalizedType === 'DEFM14A' || 
         normalizedType === 'DEF 14C' || 
         normalizedType === 'DEFM14C';
};

/**
 * Helper function to check if document is an IR document
 */
export const isIRDocument = (formType: string): boolean => {
  return formType?.toLowerCase() === 'ir';
};

/**
 * Helper function to check if document is a binary document (PDF)
 */
export const isBinaryDocument = (formType: string, fileType?: FileType): boolean => {
  return fileType === 'pdf';
};
