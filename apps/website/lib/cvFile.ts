// Matches the 10 MB limit on the documents bucket.
export const MAX_CV_BYTES = 10 * 1024 * 1024

export interface CheckedCv {
  extension: 'pdf' | 'doc' | 'docx'
  contentType: string
}

const startsWith = (bytes: Buffer, signature: number[]) =>
  bytes.length >= signature.length && signature.every((value, i) => bytes[i] === value)

const REJECTED = 'Please upload your CV as a PDF, DOC or DOCX file.'

/**
 * Decides the file type from its leading bytes. The file's name and claimed
 * type come from the sender, so neither is used.
 */
export function checkCvFile(bytes: Buffer): CheckedCv | { error: string } {
  if (bytes.length === 0) return { error: REJECTED }
  if (bytes.length > MAX_CV_BYTES) return { error: 'Your CV must be 10 MB or smaller.' }
  if (startsWith(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d])) return { extension: 'pdf', contentType: 'application/pdf' }
  if (startsWith(bytes, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])) return { extension: 'doc', contentType: 'application/msword' }
  // A DOCX is a zip archive, and its entry names are stored as plain text.
  if (startsWith(bytes, [0x50, 0x4b, 0x03, 0x04]) && bytes.includes('word/')) {
    return { extension: 'docx', contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }
  }
  return { error: REJECTED }
}
