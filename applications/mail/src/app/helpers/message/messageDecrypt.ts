import { decryptMIMEMessage, decryptMessageLegacy, OpenPGPKey, OpenPGPSignature } from 'pmcrypto';
import { Attachment, Message } from 'proton-shared/lib/interfaces/mail/Message';
import { VERIFICATION_STATUS } from 'proton-shared/lib/mail/constants';
import { getDate, getSender, isMIME } from 'proton-shared/lib/mail/messages';
import { c } from 'ttag';

import { MessageErrors } from '../../models/message';
import { convert } from '../attachment/attachmentConverter';
import { AttachmentsCache } from '../../containers/AttachmentProvider';
import { MIME_TYPES } from 'proton-shared/lib/constants';

const { NOT_VERIFIED } = VERIFICATION_STATUS;

const decryptMimeMessage = async (
    message: Message,
    publicKeys: OpenPGPKey[],
    privateKeys: OpenPGPKey[],
    attachmentsCache: AttachmentsCache
) => {
    const headerFilename = c('Encrypted Headers').t`Encrypted Headers filename`;
    const sender = getSender(message)?.Address;

    let result;

    try {
        result = await decryptMIMEMessage({
            message: message?.Body,
            messageDate: getDate(message),
            privateKeys: privateKeys,
            publicKeys: publicKeys,
            headerFilename,
            sender
        });
    } catch (error) {
        return {
            decryptedBody: '',
            Attachments: [],
            verified: NOT_VERIFIED,
            errors: {
                decryption: [error]
            }
        };
    }

    const { body: decryptedBody = c('Message empty').t`Message content is empty`, mimetype = MIME_TYPES.PLAINTEXT } =
        (await result.getBody()) || {};

    const verified = await result.verify();
    const errors = await result.errors();
    const [signature] = (result as any).signatures;

    const Attachments = convert(message, await result.getAttachments(), verified, attachmentsCache);
    const decryptedSubject = await result.getEncryptedSubject();

    return {
        decryptedBody,
        Attachments,
        verified,
        decryptedSubject,
        verificationErrors: errors,
        signature,
        mimetype: mimetype as MIME_TYPES
    };
};

const decryptLegacyMessage = async (message: Message, publicKeys: OpenPGPKey[], privateKeys: OpenPGPKey[]) => {
    let result: any;

    try {
        result = await decryptMessageLegacy({
            message: message?.Body,
            messageDate: getDate(message),
            privateKeys: privateKeys,
            publicKeys: publicKeys
        });
    } catch (error) {
        return {
            decryptedBody: '',
            verified: NOT_VERIFIED,
            errors: {
                decryption: error
            }
        };
    }

    const {
        data,
        verified = NOT_VERIFIED,
        signatures: [signature],
        errors
    } = result;

    return { decryptedBody: data, verified, signature, verificationErrors: errors };
};

export const decryptMessage = async (
    message: Message,
    publicKeys: OpenPGPKey[],
    privateKeys: OpenPGPKey[],
    attachmentsCache: AttachmentsCache
): Promise<{
    decryptedBody: string;
    Attachments?: Attachment[];
    verified: VERIFICATION_STATUS;
    decryptedSubject?: string;
    signature?: OpenPGPSignature;
    errors?: MessageErrors;
    verificationErrors?: Error[];
    mimetype?: MIME_TYPES;
}> => {
    if (isMIME(message)) {
        return decryptMimeMessage(message, publicKeys, privateKeys, attachmentsCache);
    } else {
        return decryptLegacyMessage(message, publicKeys, privateKeys);
    }
};
