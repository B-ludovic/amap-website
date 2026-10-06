'use client';

import { useRef } from 'react';
import { Button, ComboBox, I18nProvider, Input, ListBox, ListBoxItem, Popover } from 'react-aria-components';
import { matchesSearch } from '../../lib/memberSearch';

const optionText = (member) => `${member.lastName} ${member.firstName} — ${member.email}`;

/* Choix d'un compte dans l'annuaire : nom, prénom ou email, dans n'importe quel
   ordre et sans accents, selon la même règle que l'écran de distribution. */
export default function MemberComboBox({ members, selectedKey, onSelectionChange, label, isDisabled = false, placeholder }) {
  const isOpen = useRef(false);
  const escapeWhileOpen = useRef(false);

  return (
    <I18nProvider locale="fr-FR">
      {/* Le premier Échap referme la liste : il ne doit pas atteindre AdminModal,
          qui écoute Échap sur tout le document pour fermer la fenêtre. */}
      <div
        className="admin-combobox"
        onKeyDownCapture={(event) => { escapeWhileOpen.current = event.key === 'Escape' && isOpen.current; }}
        onKeyDown={(event) => { if (escapeWhileOpen.current) event.stopPropagation(); }}
      >
        <ComboBox
          aria-label={label}
          defaultItems={members}
          defaultFilter={matchesSearch}
          selectedKey={selectedKey}
          onSelectionChange={onSelectionChange}
          onOpenChange={(open) => { isOpen.current = open; }}
          isDisabled={isDisabled}
          allowsEmptyCollection
        >
          <div className="admin-combobox-field">
            <Input className="admin-input admin-combobox-input" placeholder={placeholder} />
            <Button className="admin-combobox-toggle">
              <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
                <path d="M2.5 4.5 6 8l3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Button>
          </div>
          <Popover className="admin-combobox-popover" offset={4}>
            <ListBox
              className="admin-combobox-list"
              renderEmptyState={() => <p className="admin-combobox-empty">Aucun compte ne correspond.</p>}
            >
              {(member) => (
                <ListBoxItem id={member.id} textValue={optionText(member)} className="admin-combobox-option">
                  <span className="admin-combobox-name">{member.lastName} {member.firstName}</span>
                  <span className="admin-combobox-email">{member.email}</span>
                </ListBoxItem>
              )}
            </ListBox>
          </Popover>
        </ComboBox>
      </div>
    </I18nProvider>
  );
}
