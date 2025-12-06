'use client';

import { useEffect, useState } from "react";
import api from "../../../lib/api";
import { useModal } from "../../../contexts/ModalContext";
import {
     Trash2,
     Palette,
     Info,
     ShoppingCart,
     Save,
     RefreshCcw
 } from "lucide-react";


 const SEASONS = [
  { value: 'SPRING', label: 'Printemps', emoji: '🌸' },
  { value: 'SUMMER', label: 'Été', emoji: '☀️' },
  { value: 'AUTUMN', label: 'Automne', emoji: '🍂' },
  { value: 'WINTER', label: 'Hiver', emoji: '❄️' },
];

export default function AdminParametresPage() {
    const { showConfirm, showSuccess, showError } = useModal();

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [exampleStats, setExampleStats] = useState(null);
    const [activeTheme, setActiveTheme] = useState('null');