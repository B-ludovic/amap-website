'use client';

import { useEffect, useState } from "react";
import api from "../../../lib/api";
import { useModal } from "../../../contexts/ModalContext";
import "../../../styles/admin/parametres.css";
import {
    Trash2,
    Palette,
    Info,
    ShoppingCart,
    Save,
    RefreshCcw,
    Tractor,
    Carrot,
    ShoppingBasket,
    MapPin,
    CheckCircle,
    Flower2,
    Sun,
    Leaf,
    Snowflake
} from "lucide-react";


const SEASONS = [
    { value: 'SPRING', label: 'Printemps', icon: Flower2 },
    { value: 'SUMMER', label: 'Été', icon: Sun },
    { value: 'AUTUMN', label: 'Automne', icon: Leaf },
    { value: 'WINTER', label: 'Hiver', icon: Snowflake },
];

const SEASON_COLORS = {
    SPRING: {
        primaryColor: '#6b9d5a',
        secondaryColor: '#d4a574',
        accentColor: '#c85a3f',
        backgroundColor: '#f9f7f4',
    },
    SUMMER: {
        primaryColor: '#f59e0b',
        secondaryColor: '#fcd34d',
        accentColor: '#fb923c',
        backgroundColor: '#fffbeb',
    },
    AUTUMN: {
        primaryColor: '#c2410c',
        secondaryColor: '#d97706',
        accentColor: '#ea580c',
        backgroundColor: '#fff7ed',
    },
    WINTER: {
        primaryColor: '#0891b2',
        secondaryColor: '#06b6d4',
        accentColor: '#0284c7',
        backgroundColor: '#f0f9ff',
    },
};

export default function AdminParametresPage() {
    const { showConfirm, showSuccess, showError } = useModal();

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [exampleStats, setExampleStats] = useState(null);
    const [totalStats, setTotalStats] = useState(null);
    const [activeTheme, setActiveTheme] = useState('null');

    // Onglet actif
    const [activeTab, setActiveTab] = useState('examples');

    // Form data pour les differentes sections
    const [themeData, setThemeData] = useState({
        season: 'SPRING',
        primaryColor: '#6b9d5a',
        secondaryColor: '#d4a574',
        accentColor: '#c85a3f',
        backgroundColor: '#f9f7f4',
    });

    const [generalData, setGeneralData] = useState({
        amapName: 'Aux P\'tits Pois',
        contactEmail: 'contact@auxptitspois.fr',
        contactPhone: '06 12 34 56 78',
        address: '12 rue de la République, 75001 Paris',
        description: 'AMAP locale proposant des paniers de produits bio et de saison',
    });

    const [orderConfig, setOrderConfig] = useState({
        minOrderDelay: 48,
        minOrderAmount: 0,
        serviceFee: 0,
        ordersEnabled: true,
    });

    const [pickupData, setPickupData] = useState({
        id: null,
        name: '',
        address: '',
        city: '',
        postalCode: '',
        schedule: 'Mercredi 18h15 - 19h15',
        instructions: '',
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
                console.log('Pas de stats exemples disponibles');
                setExampleStats({ total: 0, producers: 0, products: 0, pickupLocations: 0 });
                setTotalStats({ total: 0, producers: 0, products: 0, pickupLocations: 0 });
            }

            // Charger le thème actif si disponible
            try {
                const themeRes = await api.admin.theme.getActive();
                if (themeRes.data.theme) {
                    setActiveTheme(themeRes.data.theme);
                    setThemeData({
                        season: themeRes.data.theme.season,
                        primaryColor: themeRes.data.theme.primaryColor,
                        secondaryColor: themeRes.data.theme.secondaryColor,
                        accentColor: themeRes.data.theme.accentColor,
                        backgroundColor: themeRes.data.theme.backgroundColor,
                    });
                }
            } catch (error) {
                console.log('Pas de thème actif, utilisation du thème par défaut');
            }

            // Charger le point de retrait unique
            try {
                const pickupRes = await api.admin.pickupLocations.getAll();
                if (pickupRes.data.pickupLocations && pickupRes.data.pickupLocations.length > 0) {
                    const pickup = pickupRes.data.pickupLocations[0]; // Récupérer le premier (unique)
                    setPickupData({
                        id: pickup.id,
                        name: pickup.name,
                        address: pickup.address,
                        city: pickup.city,
                        postalCode: pickup.postalCode,
                        schedule: pickup.schedule,
                        instructions: pickup.instructions || '',
                    });
                }
            } catch (error) {
                console.log('Pas de point de retrait configuré');
            }
        } catch (error) {
            console.error('Erreur lors du chargement:', error);
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
            fetchData();
        } catch (error) {
            showError('Erreur', error.message);
        } finally {
            setSaving(false);
        }
    };

    const handleSaveGeneral = async () => {
        setSaving(true);
        try {
            // TODO: API pour sauvegarder les infos générales
            showSuccess('Informations sauvegardées', 'Les informations ont été mises à jour.');
        } catch (error) {
            showError('Erreur', error.message);
        } finally {
            setSaving(false);
        }
    };

    const handleSaveOrderConfig = async () => {
        setSaving(true);
        try {
            // TODO: API pour sauvegarder la config des commandes
            showSuccess('Configuration sauvegardée', 'La configuration a été mise à jour.');
        } catch (error) {
            showError('Erreur', error.message);
        } finally {
            setSaving(false);
        }
    };

    const handleSavePickup = async () => {
        setSaving(true);
        try {
            if (pickupData.id) {
                // Mettre à jour le point de retrait existant
                await api.admin.pickupLocations.update(pickupData.id, {
                    name: pickupData.name,
                    address: pickupData.address,
                    city: pickupData.city,
                    postalCode: pickupData.postalCode,
                    schedule: pickupData.schedule,
                    instructions: pickupData.instructions,
                });
            } else {
                // Créer un nouveau point de retrait
                const response = await api.admin.pickupLocations.create({
                    name: pickupData.name,
                    address: pickupData.address,
                    city: pickupData.city,
                    postalCode: pickupData.postalCode,
                    schedule: pickupData.schedule,
                    instructions: pickupData.instructions,
                    isActive: true,
                });
                setPickupData({ ...pickupData, id: response.data.pickupLocation.id });
            }
            showSuccess('Point de retrait sauvegardé', 'Les informations ont été mises à jour.');
        } catch (error) {
            showError('Erreur', error.response?.data?.message || error.message);
        } finally {
            setSaving(false);
        }
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
                    <button
                        onClick={() => setActiveTab('pickup')}
                        className={`admin-tab ${activeTab === 'pickup' ? 'admin-tab-active' : ''}`}
                    >
                        <MapPin size={18} />
                        Point de retrait
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
                                    <h3 style={{ marginTop: '2rem', marginBottom: '1rem', fontSize: '1.1rem', color: 'var(--text-dark)' }}>
                                        📊 Données totales en base
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
                                    <h3 style={{ marginTop: '2rem', marginBottom: '1rem', fontSize: '1.1rem', color: 'var(--text-dark)' }}>
                                        🧪 Données d'exemple uniquement
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

                    {/* POINT DE RETRAIT */}
                    {activeTab === 'pickup' && (
                        <div className="admin-section">
                            <h2 className="admin-section-title">Point de retrait</h2>
                            <p className="admin-section-description">
                                Configurez l'adresse et les horaires du point de retrait unique de votre AMAP.
                            </p>

                            <div className="form-grid">
                                <div className="form-group form-group-full">
                                    <label htmlFor="pickupName" className="form-label">
                                        Nom du lieu
                                    </label>
                                    <input
                                        type="text"
                                        id="pickupName"
                                        value={pickupData.name}
                                        onChange={(e) => setPickupData({ ...pickupData, name: e.target.value })}
                                        placeholder="Ex: Maison des associations"
                                        className="input"
                                    />
                                </div>

                                <div className="form-group form-group-full">
                                    <label htmlFor="pickupAddress" className="form-label">
                                        Adresse complète
                                    </label>
                                    <input
                                        type="text"
                                        id="pickupAddress"
                                        value={pickupData.address}
                                        onChange={(e) => setPickupData({ ...pickupData, address: e.target.value })}
                                        placeholder="12 rue de la République"
                                        className="input"
                                    />
                                </div>

                                <div className="form-group">
                                    <label htmlFor="pickupCity" className="form-label">
                                        Ville
                                    </label>
                                    <input
                                        type="text"
                                        id="pickupCity"
                                        value={pickupData.city}
                                        onChange={(e) => setPickupData({ ...pickupData, city: e.target.value })}
                                        placeholder="Paris"
                                        className="input"
                                    />
                                </div>

                                <div className="form-group">
                                    <label htmlFor="pickupPostalCode" className="form-label">
                                        Code postal
                                    </label>
                                    <input
                                        type="text"
                                        id="pickupPostalCode"
                                        value={pickupData.postalCode}
                                        onChange={(e) => setPickupData({ ...pickupData, postalCode: e.target.value })}
                                        placeholder="75001"
                                        className="input"
                                    />
                                </div>

                                <div className="form-group form-group-full">
                                    <label htmlFor="pickupSchedule" className="form-label">
                                        Horaires de retrait
                                    </label>
                                    <input
                                        type="text"
                                        id="pickupSchedule"
                                        value={pickupData.schedule}
                                        onChange={(e) => setPickupData({ ...pickupData, schedule: e.target.value })}
                                        placeholder="Mercredi 18h15 - 19h15"
                                        className="input"
                                    />
                                    <p className="form-help">
                                        Indiquez les jours et heures de distribution
                                    </p>
                                </div>

                                <div className="form-group form-group-full">
                                    <label htmlFor="pickupInstructions" className="form-label">
                                        Instructions d'accès
                                    </label>
                                    <textarea
                                        id="pickupInstructions"
                                        value={pickupData.instructions}
                                        onChange={(e) => setPickupData({ ...pickupData, instructions: e.target.value })}
                                        placeholder="Code porte: 1234A, Parking disponible rue adjacente..."
                                        className="textarea"
                                        rows="4"
                                    />
                                    <p className="form-help">
                                        Informations pratiques pour les adhérents (code porte, parking, etc.)
                                    </p>
                                </div>
                            </div>

                            <button
                                onClick={handleSavePickup}
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