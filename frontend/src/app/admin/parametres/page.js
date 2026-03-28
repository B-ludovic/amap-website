'use client';

import { useEffect, useState } from "react";
import api from "../../../lib/api";
import logger from "../../../lib/logger";
import { useModal } from "../../../contexts/ModalContext";
import { useTheme } from "../../../contexts/ThemeContext";
import "../../../styles/admin/parametres.css";
import {
    Trash2,
    Palette,
    Info,
    Save,
    Tractor,
    Carrot,
    MapPin,
    CheckCircle,
    Flower2,
    Sun,
    Leaf,
    Snowflake,
    BarChart3,
    Beaker
} from "lucide-react";


const SEASONS = [
    { value: 'SPRING', label: 'Printemps', icon: Flower2 },
    { value: 'SUMMER', label: 'Été', icon: Sun },
    { value: 'AUTUMN', label: 'Automne', icon: Leaf },
    { value: 'WINTER', label: 'Hiver', icon: Snowflake },
];

const SEASON_COLORS = {
    SPRING: {
        primaryColor: '#4a7a3a',
        secondaryColor: '#d4a574',
        accentColor: '#b04535',
        backgroundColor: '#f9f7f4',
    },
    SUMMER: {
        primaryColor: '#c47d0a',
        secondaryColor: '#fcd34d',
        accentColor: '#a85508',
        backgroundColor: '#fffbeb',
    },
    AUTUMN: {
        primaryColor: '#c2410c',
        secondaryColor: '#d97706',
        accentColor: '#b91c1c',
        backgroundColor: '#fff7ed',
    },
    WINTER: {
        primaryColor: '#0e7490',
        secondaryColor: '#06b6d4',
        accentColor: '#1d4ed8',
        backgroundColor: '#f0f9ff',
    },
};

export default function AdminParametresPage() {
    const { showConfirm, showSuccess, showError } = useModal();
    const { loadTheme } = useTheme();

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [exampleStats, setExampleStats] = useState(null);
    const [totalStats, setTotalStats] = useState(null);
    // Onglet actif
    const [activeTab, setActiveTab] = useState('examples');

    // Form data pour les differentes sections
    const [themeData, setThemeData] = useState({
        season: 'SPRING',
        primaryColor: '#4a7a3a',
        secondaryColor: '#d4a574',
        accentColor: '#b04535',
        backgroundColor: '#f9f7f4',
    });

    const [generalData, setGeneralData] = useState({
        amapName: 'Aux P\'tits Pois',
        contactEmail: 'contact@auxptitspois.fr',
        contactPhone: '06 12 34 56 78',
        address: '12 rue de la République, 75001 Paris',
        description: 'AMAP locale proposant des paniers de produits bio et de saison',
    });

    useEffect(() => {
        fetchData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            // Charger les stats exemples si disponibles
            try {
                const examplesRes = await api.admin.examples.getStats();
                setExampleStats(examplesRes.data.examples);
                setTotalStats(examplesRes.data.totals);
            } catch (error) {
                logger.log('Pas de stats exemples disponibles');
                setExampleStats({ total: 0, producers: 0, products: 0, pickupLocations: 0 });
                setTotalStats({ total: 0, producers: 0, products: 0, pickupLocations: 0 });
            }

            // Charger le thème actif si disponible
            try {
                const themeRes = await api.admin.theme.getActive();
                if (themeRes.data.theme) {
                    setThemeData({
                        season: themeRes.data.theme.season,
                        primaryColor: themeRes.data.theme.primaryColor,
                        secondaryColor: themeRes.data.theme.secondaryColor,
                        accentColor: themeRes.data.theme.accentColor,
                        backgroundColor: themeRes.data.theme.backgroundColor,
                    });
                }
            } catch (error) {
                logger.log('Pas de thème actif, utilisation du thème par défaut');
            }

        } catch (error) {
            logger.error('Erreur lors du chargement:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteExamples = () => {
        showConfirm(
            'Supprimer tous les exemples',
            `Cette action supprimera définitivement ${exampleStats.total} exemple(s) : ${exampleStats.producers} producteur(s), ${exampleStats.products} produit(s), ${exampleStats.baskets} panier(s) et ${exampleStats.pickupLocations} point(s) de retrait. Cette action est irréversible. Continuer ?`,
            async () => {
                try {
                    await api.admin.examples.deleteAll();
                    showSuccess(
                        'Exemples supprimés',
                        'Tous les exemples ont été supprimés avec succès.'
                    );
                    fetchData();
                } catch (error) {
                    showError('Erreur', error.message);
                }
            }
        );
    };

    const handleSaveTheme = async () => {
        setSaving(true);
        try {
            await api.admin.theme.update(themeData);
            showSuccess('Thème sauvegardé', 'Le thème a été mis à jour avec succès.');
            await loadTheme(); // Recharger et appliquer le thème immédiatement
            fetchData();
        } catch (error) {
            showError('Erreur', error.message);
        } finally {
            setSaving(false);
        }
    };

    const handleSaveGeneral = () => {
        showError('Non disponible', 'La sauvegarde des informations générales n\'est pas encore prise en charge par le serveur.');
    };

    const handleThemeChange = (field, value) => {
        if (field === 'season') {
            // Quand on change de saison, appliquer les couleurs correspondantes
            setThemeData(prev => ({
                ...prev,
                season: value,
                ...SEASON_COLORS[value]
            }));
        } else {
            setThemeData(prev => ({ ...prev, [field]: value }));
        }
    };

    if (loading) {
        return (
            <div className="admin-page">
                <div className="admin-loading">
                    <p>Chargement des paramètres...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="admin-page">
            <div className="admin-page-header">
                <div>
                    <h1 className="admin-page-title">Paramètres</h1>
                    <p className="admin-page-description">
                        Configurez votre plateforme AMAP
                    </p>
                </div>
            </div>

            <div className="admin-page-content">
                {/* Tabs */}
                <div className="admin-tabs">
                    <button
                        onClick={() => setActiveTab('examples')}
                        className={`admin-tab ${activeTab === 'examples' ? 'admin-tab-active' : ''}`}
                    >
                        <Trash2 size={18} />
                        Données d'exemple
                    </button>
                    <button
                        onClick={() => setActiveTab('theme')}
                        className={`admin-tab ${activeTab === 'theme' ? 'admin-tab-active' : ''}`}
                    >
                        <Palette size={18} />
                        Thème
                    </button>
                    <button
                        onClick={() => setActiveTab('general')}
                        className={`admin-tab ${activeTab === 'general' ? 'admin-tab-active' : ''}`}
                    >
                        <Info size={18} />
                        Informations générales
                    </button>
                </div>

                {/* Tab Content */}
                <div className="admin-tab-content">
                    {/* DONNÉES D'EXEMPLE */}
                    {activeTab === 'examples' && (
                        <div className="admin-section">
                            <h2 className="admin-section-title">Données d'exemple</h2>
                            <p className="admin-section-description">
                                Ces données ont été créées automatiquement pour tester la plateforme.
                                Vous pouvez les supprimer une fois que vous avez ajouté vos propres données.
                            </p>

                            {/* Stats totales */}
                            {totalStats && (
                                <>
                                    <h3 className="examples-section-title">
                                        <BarChart3 size={20} /> Données totales en base
                                    </h3>
                                    <div className="examples-stats-grid">
                                        <div className="examples-stat-card">
                                            <div className="examples-stat-icon">
                                                <Tractor size={24} />
                                            </div>
                                            <div>
                                                <p className="examples-stat-value">{totalStats.producers}</p>
                                                <p className="examples-stat-label">Producteur(s)</p>
                                            </div>
                                        </div>

                                        <div className="examples-stat-card">
                                            <div className="examples-stat-icon">
                                                <Carrot size={24} />
                                            </div>
                                            <div>
                                                <p className="examples-stat-value">{totalStats.products}</p>
                                                <p className="examples-stat-label">Produit(s)</p>
                                            </div>
                                        </div>

                                        <div className="examples-stat-card">
                                            <div className="examples-stat-icon">
                                                <MapPin size={24} />
                                            </div>
                                            <div>
                                                <p className="examples-stat-value">{totalStats.pickupLocations}</p>
                                                <p className="examples-stat-label">Point(s) de retrait</p>
                                            </div>
                                        </div>
                                    </div>
                                </>
                            )}

                            {/* Stats exemples */}
                            {exampleStats && exampleStats.total > 0 ? (
                                <>
                                    <h3 className="examples-section-title">
                                        <Beaker size={20} /> Données d'exemple uniquement
                                    </h3>
                                    <div className="examples-stats-grid">
                                        <div className="examples-stat-card">
                                            <div className="examples-stat-icon">
                                                <Tractor size={24} />
                                            </div>
                                            <div>
                                                <p className="examples-stat-value">{exampleStats.producers}</p>
                                                <p className="examples-stat-label">Producteur(s)</p>
                                            </div>
                                        </div>

                                        <div className="examples-stat-card">
                                            <div className="examples-stat-icon">
                                                <Carrot size={24} />
                                            </div>
                                            <div>
                                                <p className="examples-stat-value">{exampleStats.products}</p>
                                                <p className="examples-stat-label">Produit(s)</p>
                                            </div>
                                        </div>

                                        <div className="examples-stat-card">
                                            <div className="examples-stat-icon">
                                                <MapPin size={24} />
                                            </div>
                                            <div>
                                                <p className="examples-stat-value">{exampleStats.pickupLocations}</p>
                                                <p className="examples-stat-label">Point(s) de retrait</p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="examples-actions">
                                        <button
                                            onClick={handleDeleteExamples}
                                            className="btn btn-error"
                                        >
                                            <Trash2 size={20} />
                                            Supprimer tous les exemples ({exampleStats.total})
                                        </button>
                                    </div>
                                </>
                            ) : (
                                <div className="admin-empty-state">
                                    <CheckCircle size={48} className="admin-empty-icon" />
                                    <p>Aucun exemple détecté</p>
                                    <p className="text-secondary">Vous avez supprimé tous les exemples ou vous utilisez vos propres données.</p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* THÈME */}
                    {activeTab === 'theme' && (
                        <div className="admin-section">
                            <h2 className="admin-section-title">Thème saisonnier</h2>
                            <p className="admin-section-description">
                                Personnalisez les couleurs de votre site selon les saisons.
                            </p>

                            <div className="theme-form">
                                <div className="form-group">
                                    <label className="form-label">Saison active</label>
                                    <div className="season-selector">
                                        {SEASONS.map(season => {
                                            const Icon = season.icon;
                                            return (
                                                <button
                                                    key={season.value}
                                                    type="button"
                                                    onClick={() => handleThemeChange('season', season.value)}
                                                    className={`season-btn ${themeData.season === season.value ? 'season-btn-active' : ''}`}
                                                >
                                                    <Icon size={20} />
                                                    <span>{season.label}</span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                <div className="form-grid">
                                    <div className="form-group">
                                        <label htmlFor="primaryColor" className="form-label">
                                            Couleur primaire
                                        </label>
                                        <div className="color-input-group">
                                            <input
                                                type="color"
                                                id="primaryColor"
                                                value={themeData.primaryColor}
                                                onChange={(e) => handleThemeChange('primaryColor', e.target.value)}
                                                className="color-input"
                                            />
                                            <input
                                                type="text"
                                                value={themeData.primaryColor}
                                                onChange={(e) => handleThemeChange('primaryColor', e.target.value)}
                                                className="input"
                                                placeholder="#6b9d5a"
                                            />
                                        </div>
                                    </div>

                                    <div className="form-group">
                                        <label htmlFor="secondaryColor" className="form-label">
                                            Couleur secondaire
                                        </label>
                                        <div className="color-input-group">
                                            <input
                                                type="color"
                                                id="secondaryColor"
                                                value={themeData.secondaryColor}
                                                onChange={(e) => handleThemeChange('secondaryColor', e.target.value)}
                                                className="color-input"
                                            />
                                            <input
                                                type="text"
                                                value={themeData.secondaryColor}
                                                onChange={(e) => handleThemeChange('secondaryColor', e.target.value)}
                                                className="input"
                                                placeholder="#d4a574"
                                            />
                                        </div>
                                    </div>

                                    <div className="form-group">
                                        <label htmlFor="accentColor" className="form-label">
                                            Couleur d'accent
                                        </label>
                                        <div className="color-input-group">
                                            <input
                                                type="color"
                                                id="accentColor"
                                                value={themeData.accentColor}
                                                onChange={(e) => handleThemeChange('accentColor', e.target.value)}
                                                className="color-input"
                                            />
                                            <input
                                                type="text"
                                                value={themeData.accentColor}
                                                onChange={(e) => handleThemeChange('accentColor', e.target.value)}
                                                className="input"
                                                placeholder="#c85a3f"
                                            />
                                        </div>
                                    </div>

                                    <div className="form-group">
                                        <label htmlFor="backgroundColor" className="form-label">
                                            Couleur de fond
                                        </label>
                                        <div className="color-input-group">
                                            <input
                                                type="color"
                                                id="backgroundColor"
                                                value={themeData.backgroundColor}
                                                onChange={(e) => handleThemeChange('backgroundColor', e.target.value)}
                                                className="color-input"
                                            />
                                            <input
                                                type="text"
                                                value={themeData.backgroundColor}
                                                onChange={(e) => handleThemeChange('backgroundColor', e.target.value)}
                                                className="input"
                                                placeholder="#f9f7f4"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Aperçu */}
                                <div className="theme-preview">
                                    <p className="form-label">Aperçu</p>
                                    <div
                                        className="theme-preview-box"
                                        style={{
                                            background: `linear-gradient(135deg, ${themeData.primaryColor} 0%, ${themeData.secondaryColor} 100%)`,
                                        }}
                                    >
                                        <div
                                            className="theme-preview-card"
                                            style={{ backgroundColor: themeData.backgroundColor }}
                                        >
                                            <h3 style={{ color: themeData.accentColor }}>Aux P'tits Pois</h3>
                                            <p>Aperçu du thème sélectionné</p>
                                        </div>
                                    </div>
                                </div>

                                <button
                                    onClick={handleSaveTheme}
                                    disabled={saving}
                                    className="btn btn-primary"
                                >
                                    <Save size={20} />
                                    {saving ? 'Enregistrement...' : 'Sauvegarder le thème'}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* INFORMATIONS GÉNÉRALES */}
                    {activeTab === 'general' && (
                        <div className="admin-section">
                            <h2 className="admin-section-title">Informations générales</h2>
                            <p className="admin-section-description">
                                Informations de contact et présentation de votre AMAP.
                            </p>

                            <div className="form-grid">
                                <div className="form-group">
                                    <label htmlFor="amapName" className="form-label">
                                        Nom de l'AMAP
                                    </label>
                                    <input
                                        type="text"
                                        id="amapName"
                                        value={generalData.amapName}
                                        onChange={(e) => setGeneralData({ ...generalData, amapName: e.target.value })}
                                        className="input"
                                        placeholder="Aux P'tits Pois"
                                    />
                                </div>

                                <div className="form-group">
                                    <label htmlFor="contactEmail" className="form-label">
                                        Email de contact
                                    </label>
                                    <input
                                        type="email"
                                        id="contactEmail"
                                        value={generalData.contactEmail}
                                        onChange={(e) => setGeneralData({ ...generalData, contactEmail: e.target.value })}
                                        className="input"
                                        placeholder="contact@auxptitspois.fr"
                                    />
                                </div>

                                <div className="form-group">
                                    <label htmlFor="contactPhone" className="form-label">
                                        Téléphone
                                    </label>
                                    <input
                                        type="tel"
                                        id="contactPhone"
                                        value={generalData.contactPhone}
                                        onChange={(e) => setGeneralData({ ...generalData, contactPhone: e.target.value })}
                                        className="input"
                                        placeholder="06 12 34 56 78"
                                    />
                                </div>

                                <div className="form-group">
                                    <label htmlFor="address" className="form-label">
                                        Adresse
                                    </label>
                                    <input
                                        type="text"
                                        id="address"
                                        value={generalData.address}
                                        onChange={(e) => setGeneralData({ ...generalData, address: e.target.value })}
                                        className="input"
                                        placeholder="12 rue de la République, 75001 Paris"
                                    />
                                </div>

                                <div className="form-group form-group-full">
                                    <label htmlFor="description" className="form-label">
                                        Description
                                    </label>
                                    <textarea
                                        id="description"
                                        value={generalData.description}
                                        onChange={(e) => setGeneralData({ ...generalData, description: e.target.value })}
                                        className="textarea"
                                        rows="4"
                                        placeholder="Décrivez votre AMAP..."
                                    />
                                </div>
                            </div>

                            <button
                                onClick={handleSaveGeneral}
                                disabled={saving}
                                className="btn btn-primary"
                            >
                                <Save size={20} />
                                {saving ? 'Enregistrement...' : 'Sauvegarder'}
                            </button>
                        </div>
                    )}

                </div>
            </div>
        </div>
    );
}