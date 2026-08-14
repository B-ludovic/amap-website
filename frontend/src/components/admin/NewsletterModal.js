'use client';

import { useState, useEffect } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { useModal } from '../../contexts/ModalContext';
import api from '../../lib/api';
import AdminModal from './AdminModal';

/* Types et destinataires viennent des enums NewsletterType et
   NewsletterTarget. La maquette en proposait d'autres — « Fermeture », « Appel
   à bénévoles », « Bénévoles » — qui n'existent pas en base. */
const TYPE_OPTIONS = [
  { value: 'GENERAL', label: 'Général' },
  { value: 'WEEKLY_BASKET', label: 'Panier de la semaine' },
  { value: 'RECIPE', label: 'Recette' },
  { value: 'ALERT', label: 'Alerte' },
  { value: 'PRODUCER_NEWS', label: 'Nouvelles des producteurs' }
];

const TARGET_OPTIONS = [
  { value: 'ALL', label: 'Tous les adhérents' },
  { value: 'ACTIVE_SUBSCRIBERS', label: 'Abonnés actifs uniquement' },
  { value: 'SOLIDARITY', label: 'Tarif solidaire' },
  { value: 'TEST', label: 'Test — moi uniquement' }
];

/* Barre d'outils en boutons texte : la DA ne pose aucune icône, un libellé
   lisible remplace le pictogramme. */
function Toolbar({ editor }) {
  if (!editor) return null;

  const tools = [
    { label: 'Gras', run: () => editor.chain().focus().toggleBold().run(), active: editor.isActive('bold') },
    { label: 'Italique', run: () => editor.chain().focus().toggleItalic().run(), active: editor.isActive('italic') },
    { label: 'Titre', run: () => editor.chain().focus().toggleHeading({ level: 2 }).run(), active: editor.isActive('heading', { level: 2 }) },
    { label: 'Sous-titre', run: () => editor.chain().focus().toggleHeading({ level: 3 }).run(), active: editor.isActive('heading', { level: 3 }) },
    { label: 'Liste', run: () => editor.chain().focus().toggleBulletList().run(), active: editor.isActive('bulletList') },
    { label: 'Liste numérotée', run: () => editor.chain().focus().toggleOrderedList().run(), active: editor.isActive('orderedList') },
    { label: 'Séparateur', run: () => editor.chain().focus().setHorizontalRule().run(), active: false }
  ];

  return (
    <div className="admin-editor-toolbar">
      {tools.map(tool => (
        <button
          key={tool.label}
          type="button"
          className={`admin-editor-tool ${tool.active ? 'admin-editor-tool-active' : ''}`}
          onClick={tool.run}
        >
          {tool.label}
        </button>
      ))}
    </div>
  );
}

export default function NewsletterModal({ newsletter, onClose }) {
  const { showSuccess, showError } = useModal();
  const isEdit = !!newsletter;

  const [formData, setFormData] = useState({
    subject: newsletter?.subject ?? '',
    type: newsletter?.type ?? 'GENERAL',
    target: newsletter?.target ?? 'ALL'
  });
  const [sendMode, setSendMode] = useState(null);
  const [scheduledFor, setScheduledFor] = useState(newsletter?.scheduledFor?.split('.')[0] ?? '');
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: 'Rédigez la newsletter…' })
    ],
    content: newsletter?.content || ''
  });

  useEffect(() => {
    if (!newsletter) return;
    setFormData({
      subject: newsletter.subject,
      type: newsletter.type,
      target: newsletter.target
    });
    if (newsletter.scheduledFor) {
      setScheduledFor(newsletter.scheduledFor.split('.')[0]);
    }
  }, [newsletter]);

  const validate = () => {
    const found = {};
    if (!formData.subject?.trim()) found.subject = 'Objet requis';

    const html = editor?.getHTML() ?? '';
    if (!html || html === '<p></p>') found.content = 'Contenu requis';
    if (sendMode === 'schedule' && !scheduledFor) found.scheduledFor = 'Date et heure requises';

    setErrors(found);
    return Object.keys(found).length === 0;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!validate()) return;

    const payload = { ...formData, content: editor.getHTML() };

    setLoading(true);
    try {
      if (isEdit) {
        await api.newsletters.update(newsletter.id, payload);
        showSuccess('Newsletter modifiée', 'Les modifications ont été enregistrées.');
      } else {
        const response = await api.newsletters.create(payload);

        if (sendMode === 'now') {
          await api.newsletters.send(response.data.id);
          showSuccess('Newsletter envoyée', 'Le message est parti vers ses destinataires.');
        } else if (sendMode === 'schedule') {
          await api.newsletters.schedule(response.data.id, { scheduledFor });
          showSuccess('Newsletter programmée', 'L\'envoi partira à la date indiquée.');
        } else {
          showSuccess('Brouillon enregistré', 'La newsletter est prête à être relue.');
        }
      }
      onClose(true);
    } catch (error) {
      showError('Erreur', error.message || 'Une erreur est survenue.');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData(current => ({ ...current, [name]: value }));
    if (errors[name]) setErrors(current => ({ ...current, [name]: '' }));
  };

  return (
    <AdminModal
      title={isEdit ? 'Modifier la newsletter' : 'Nouvelle newsletter'}
      width="760px"
      onClose={() => onClose(false)}
    >
      <form onSubmit={handleSubmit}>
        <div className="admin-form">
          <div className="admin-form-field">
            <label htmlFor="nl-subject" className="admin-field-label">Objet *</label>
            <input
              id="nl-subject"
              name="subject"
              type="text"
              className="admin-input"
              placeholder="Ex : Panier de la semaine du 15 janvier"
              value={formData.subject}
              onChange={handleChange}
            />
            {errors.subject && <span className="admin-form-error">{errors.subject}</span>}
          </div>

          <div className="admin-form-row">
            <div className="admin-form-field">
              <label htmlFor="nl-type" className="admin-field-label">Type</label>
              <select id="nl-type" name="type" className="admin-select-full" value={formData.type} onChange={handleChange}>
                {TYPE_OPTIONS.map(option => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
            <div className="admin-form-field">
              <label htmlFor="nl-target" className="admin-field-label">Destinataires *</label>
              <select id="nl-target" name="target" className="admin-select-full" value={formData.target} onChange={handleChange}>
                {TARGET_OPTIONS.map(option => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="admin-form-field">
            <span className="admin-field-label">Contenu *</span>
            <div className="admin-editor">
              <Toolbar editor={editor} />
              <EditorContent editor={editor} />
            </div>
            {errors.content && <span className="admin-form-error">{errors.content}</span>}
          </div>

          {!isEdit && (
            <div className="admin-form-field">
              <span className="admin-field-label">Action après sauvegarde</span>
              <div className="admin-radios">
                <label className="admin-radio">
                  <input type="radio" name="sendMode" checked={sendMode === null} onChange={() => setSendMode(null)} />
                  <span>Enregistrer comme brouillon</span>
                </label>
                <label className="admin-radio">
                  <input type="radio" name="sendMode" checked={sendMode === 'now'} onChange={() => setSendMode('now')} />
                  <span>Envoyer maintenant</span>
                </label>
                <label className="admin-radio">
                  <input type="radio" name="sendMode" checked={sendMode === 'schedule'} onChange={() => setSendMode('schedule')} />
                  <span>Programmer l&apos;envoi</span>
                </label>
              </div>
            </div>
          )}

          {sendMode === 'schedule' && (
            <div className="admin-form-field" style={{ maxWidth: '280px' }}>
              <label htmlFor="nl-when" className="admin-field-label">Date et heure d&apos;envoi</label>
              <input
                id="nl-when"
                type="datetime-local"
                className="admin-input admin-input-mono"
                value={scheduledFor}
                onChange={(event) => setScheduledFor(event.target.value)}
              />
              {errors.scheduledFor && <span className="admin-form-error">{errors.scheduledFor}</span>}
            </div>
          )}
        </div>

        <div className="admin-modal-actions">
          <button type="submit" className="admin-btn-primary" disabled={loading}>
            {loading ? 'Enregistrement…'
              : sendMode === 'now' ? 'Créer et envoyer'
              : sendMode === 'schedule' ? 'Créer et programmer'
              : isEdit ? 'Enregistrer' : 'Créer le brouillon'}
          </button>
          <button type="button" className="admin-btn-ghost" onClick={() => onClose(false)} disabled={loading}>
            Annuler
          </button>
        </div>
      </form>
    </AdminModal>
  );
}
