'use client';

import { useState, useEffect, useRef } from 'react';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { X, Mail, Users, Clock, Bold, Italic, List, ListOrdered, Heading2, Heading3, Minus } from 'lucide-react';
import { useModal } from '../../contexts/ModalContext';
import api from '../../lib/api';
import '../../styles/admin/tiptap.css';
import '../../styles/admin/components.css';
import '../../styles/admin/tiptap.css';

function Toolbar({ editor }) {
  if (!editor) return null;

  return (
    <div className="tiptap-toolbar">
      <button type="button" onClick={() => editor.chain().focus().toggleBold().run()} className={editor.isActive('bold') ? 'active' : ''} title="Gras">
        <Bold size={16} />
      </button>
      <button type="button" onClick={() => editor.chain().focus().toggleItalic().run()} className={editor.isActive('italic') ? 'active' : ''} title="Italique">
        <Italic size={16} />
      </button>
      <div className="tiptap-divider" />
      <button type="button" onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} className={editor.isActive('heading', { level: 2 }) ? 'active' : ''} title="Titre">
        <Heading2 size={16} />
      </button>
      <button type="button" onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} className={editor.isActive('heading', { level: 3 }) ? 'active' : ''} title="Sous-titre">
        <Heading3 size={16} />
      </button>
      <div className="tiptap-divider" />
      <button type="button" onClick={() => editor.chain().focus().toggleBulletList().run()} className={editor.isActive('bulletList') ? 'active' : ''} title="Liste à puces">
        <List size={16} />
      </button>
      <button type="button" onClick={() => editor.chain().focus().toggleOrderedList().run()} className={editor.isActive('orderedList') ? 'active' : ''} title="Liste numérotée">
        <ListOrdered size={16} />
      </button>
      <div className="tiptap-divider" />
      <button type="button" onClick={() => editor.chain().focus().setHorizontalRule().run()} title="Séparateur">
        <Minus size={16} />
      </button>
    </div>
  );
}

export default function NewsletterModal({ newsletter, onClose }) {
  const containerRef = useRef(null);
  useFocusTrap(containerRef);
  const [formData, setFormData] = useState({
    subject: '',
    type: 'GENERAL',
    target: 'ALL'
  });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [sendMode, setSendMode] = useState(null);
  const [scheduledFor, setScheduledFor] = useState('');

  const { showSuccess, showError } = useModal();
  const isEdit = !!newsletter;

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: 'Rédigez votre message...' }),
    ],
    content: newsletter?.content || '',
    editorProps: {
      attributes: {
        class: 'tiptap-editor',
      },
    },
  });

  useEffect(() => {
    if (newsletter) {
      setFormData({
        subject: newsletter.subject,
        type: newsletter.type,
        target: newsletter.target,
      });
      if (newsletter.scheduledFor) {
        setScheduledFor(newsletter.scheduledFor.split('.')[0]);
      }
    }
  }, [newsletter]);

  const validate = () => {
    const newErrors = {};
    if (!formData.subject?.trim()) newErrors.subject = 'Sujet requis';
    const html = editor?.getHTML() ?? '';
    if (!html || html === '<p></p>') newErrors.content = 'Contenu requis';
    if (sendMode === 'schedule' && !scheduledFor) newErrors.scheduledFor = 'Date et heure requises';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    const payload = { ...formData, content: editor.getHTML() };

    try {
      setLoading(true);
      if (isEdit) {
        await api.newsletters.update(newsletter.id, payload);
        showSuccess('Succès', 'Newsletter modifiée avec succès');
      } else {
        const response = await api.newsletters.create(payload);
        if (sendMode === 'now') {
          await api.newsletters.send(response.data.id);
          showSuccess('Succès', 'Newsletter créée et envoyée avec succès');
        } else if (sendMode === 'schedule') {
          await api.newsletters.schedule(response.data.id, { scheduledFor });
          showSuccess('Succès', 'Newsletter programmée avec succès');
        } else {
          showSuccess('Succès', 'Newsletter sauvegardée en brouillon');
        }
      }
      onClose(true);
    } catch (error) {
      showError('Erreur', error.response?.data?.message || 'Une erreur est survenue');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors(prev => ({ ...prev, [name]: '' }));
  };

  const typeOptions = [
    { value: 'GENERAL', label: 'Général' },
    { value: 'WEEKLY_BASKET', label: 'Panier de la semaine' },
    { value: 'RECIPE', label: 'Recette' },
    { value: 'ALERT', label: 'Alerte' },
    { value: 'PRODUCER_NEWS', label: 'Nouvelles des producteurs' }
  ];

  const targetOptions = [
    { value: 'ALL', label: 'Tous les adhérents' },
    { value: 'ACTIVE_SUBSCRIBERS', label: 'Abonnés actifs uniquement' },
    { value: 'SOLIDARITY', label: 'Tarif solidaire' },
    { value: 'TEST', label: 'Test (moi uniquement)' }
  ];

  useEffect(() => {
    const handleEscape = (e) => { if (e.key === 'Escape') onClose(false); };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  return (
    <div className="modal-overlay" onClick={() => onClose(false)}>
      <div className="modal-container modal-large" ref={containerRef} role="dialog" aria-modal="true" aria-labelledby="modal-title-newsletter" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 id="modal-title-newsletter">{isEdit ? 'Modifier la newsletter' : 'Nouvelle newsletter'}</h2>
          <button className="modal-close" onClick={() => onClose(false)}>
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-grid">
              <div className="form-group">
                <label htmlFor="subject">
                  <Mail size={18} />
                  Sujet *
                </label>
                <input
                  type="text"
                  id="subject"
                  name="subject"
                  value={formData.subject}
                  onChange={handleChange}
                  placeholder="Ex: Panier de la semaine du 15 janvier"
                  className={errors.subject ? 'input-error' : ''}
                  required
                />
                {errors.subject && <span className="error-message">{errors.subject}</span>}
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="type">Type</label>
                  <select id="type" name="type" value={formData.type} onChange={handleChange}>
                    {typeOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label htmlFor="target">
                    <Users size={18} />
                    Destinataires
                  </label>
                  <select id="target" name="target" value={formData.target} onChange={handleChange}>
                    {targetOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label>Contenu *</label>
                <div className={`tiptap-wrapper ${errors.content ? 'input-error' : ''}`}>
                  <Toolbar editor={editor} />
                  <EditorContent editor={editor} />
                </div>
                {errors.content && <span className="error-message">{errors.content}</span>}
              </div>

              {!isEdit && (
                <div className="form-group">
                  <label>Action après sauvegarde</label>
                  <div className="radio-group">
                    <label className="radio-label">
                      <input type="radio" name="sendMode" checked={sendMode === null} onChange={() => setSendMode(null)} />
                      <span>Sauvegarder en brouillon</span>
                    </label>
                    <label className="radio-label">
                      <input type="radio" name="sendMode" checked={sendMode === 'now'} onChange={() => setSendMode('now')} />
                      <span>Envoyer maintenant</span>
                    </label>
                    <label className="radio-label">
                      <input type="radio" name="sendMode" checked={sendMode === 'schedule'} onChange={() => setSendMode('schedule')} />
                      <span>Programmer l'envoi</span>
                    </label>
                  </div>
                </div>
              )}

              {sendMode === 'schedule' && (
                <div className="form-group">
                  <label htmlFor="scheduledFor">
                    <Clock size={18} />
                    Date et heure d'envoi
                  </label>
                  <input
                    type="datetime-local"
                    id="scheduledFor"
                    value={scheduledFor}
                    onChange={(e) => setScheduledFor(e.target.value)}
                    className={errors.scheduledFor ? 'input-error' : ''}
                  />
                  {errors.scheduledFor && <span className="error-message">{errors.scheduledFor}</span>}
                </div>
              )}
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={() => onClose(false)} disabled={loading}>
              Annuler
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Enregistrement...' :
               sendMode === 'now' ? 'Créer et envoyer' :
               sendMode === 'schedule' ? 'Créer et programmer' :
               isEdit ? 'Modifier' : 'Créer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
