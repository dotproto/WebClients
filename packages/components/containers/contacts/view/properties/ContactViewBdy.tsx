import { format, isValid } from 'date-fns';

import { getSortedProperties } from '@proton/shared/lib/contacts/properties';
import { dateLocale } from '@proton/shared/lib/i18n';
import { VCardContact, VCardDateOrText, VCardProperty } from '@proton/shared/lib/interfaces/contacts/VCard';

import { ContactViewProperties } from './ContactViewProperties';
import ContactViewProperty from './ContactViewProperty';

interface Props {
    vCardContact: VCardContact;
    isSignatureVerified?: boolean;
}

const ContactViewBdy = ({ vCardContact, isSignatureVerified = false }: Props) => {
    const bdays: VCardProperty<VCardDateOrText>[] = getSortedProperties(vCardContact, 'bday');

    if (bdays.length === 0) {
        return null;
    }

    return (
        <ContactViewProperties>
            {bdays.map((bday) => {
                const dateOrText = bday.value as VCardDateOrText;
                let formattedBday = null;
                if (dateOrText.date && isValid(dateOrText.date)) {
                    formattedBday = format(dateOrText.date, 'PP', { locale: dateLocale });
                }
                if (dateOrText.text) {
                    formattedBday = dateOrText.text;
                }

                return (
                    <ContactViewProperty
                        key={formattedBday}
                        field="bday"
                        type={bday.params?.type}
                        isSignatureVerified={isSignatureVerified}
                    >
                        <span className="mr-2 flex-item-fluid text-ellipsis">{formattedBday}</span>
                    </ContactViewProperty>
                );
            })}
        </ContactViewProperties>
    );
};

export default ContactViewBdy;
