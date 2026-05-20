// ─────────────────────────────────────────────
//  Global Error Messages
//  Usage:
//    import { ErrorTitle, ErrorContent } from './ErrorMessages';
//    ErrorTitle(0)        → "Success!"
//    ErrorContent(0)      → "Successful request."
//
//  Dynamic placeholders (replace before use):
//    ErrorContent.STATUS   – active loan status string
//    ErrorContent.LOANSCHD – loan schedule period (days)
//    ErrorContent.ADM      – account disable duration (minutes)
//    ErrorContent.FileSize – max file size in MB
// ─────────────────────────────────────────────

export const ErrorTitle = (level) => {
  const titles = {
    0:  'Success!',
    1:  'Information Message',
    2:  'Failed',
    3:  'Failed Request',
    4:  'Login Failed',
    5:  'Login Failed',
    6:  'Oops!',
    7:  'Slow connection',
    8:  'Account Locked!',
    9:  'Oh no!',
    10: 'Data Usage',
    11: 'Your session has expired',
    12: 'Grant Permission Access',
    13: 'Process Cancelled',
    14: 'File Not Supported',
    15: 'File Not Found',
    16: 'Log-in Failed!',
  };

  return titles[level] ?? 'Unknown';
};


export const ErrorContent = (level, params = {}) => {
  const {
    STATUS   = '',
    LOANSCHD = '',
    ADM      = '',
    FileSize = '',
    AFTER    = '',  // used in level 18 trailing date/text
  } = params;

  const messages = {
    0:  'Successful request.',
    1:  'Something went wrong, Please try again.',
    2:  'Failed to process your request, Please try again later.',
    3:  'Unknown error have occured, Please try again later.',
    4:  'Wrong login credentials, Please try again.',
    5:  'Wrong password, Please try again.',
    6:  'Wrong question and/or answer, Please try again.',
    7:  'Successful Account Recovery!',
    8:  'Account is not existing. Please try again.',
    9:  "This account's email is already verified.",
    10: "This account's contact number is already verified.",
    11: 'We cannot process this request as of the moment, Please try again later.',
    12: 'Unable to proceed with transaction. Loan application is temporarily disabled on your designated branch.',
    13: `You still have a loan with ${STATUS} loan status`,
    15: 'This is currently disabled, please visit your designated branch or extension office to enroll on our Bank Crediting System.',
    18: `It seems like your last credited loan is still in (${LOANSCHD}) days period. You will be allowed to loan after ${AFTER}`,
    19: 'You need to upload an image of a valid payslip in order to continue.',
    20: 'Process may vary depending on your data connection speed, Continue?',
    21: 'Failed to upload payslip.',
    22: `Our system detects multiple wrong input of pin code, This account will be disabled to login with in ${ADM} minute/s.`,
    23: `Failed to upload the image. Images Maximum File Size: ${FileSize}MB`,
    25: 'Please contact the MTMAS for further details.',
    26: 'Account is inactive.',
    27: 'Please sign in your account.',
    28: 'Mobile Loan Application is a temporary unavailable. Try again next time.',
    29: 'Click ok to allow storage access',
    30: 'Go to Settings> Apps > MTMAS > Permissions',
    31: 'Image extensions must be JPEG only.',
    32: 'Use the phone gallery in uploading payslip image.',
    33: 'Contact Number is already registered. For more information please contact our nearest branch. Thank you.',
    34: 'Failed to send an email for your OBC enrollment. Please try again later.',
    35: 'Failed to submit your OBC enrollmment. Please try again',
    36: 'Failed getting your details. Please try again',
    37: 'Failed checking your status. Please try again',
    38: 'Failed getting references. Please try again',
  };

  return messages[level] ?? "I dont know what happened.";
};
