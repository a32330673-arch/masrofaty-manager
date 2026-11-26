import React, { useState, useEffect } from 'react';
import {
  StyleSheet, Text, View, TextInput, TouchableOpacity, FlatList,
  Modal, Alert, SafeAreaView, StatusBar, ScrollView, ActivityIndicator
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

const STORAGE_KEY = 'masrofaty_manager_local_v1';
const CATEGORIES = ['مواصلات', 'أكل', 'فواتير', 'إيجار', 'أخرى'];

export default function App() {
  const [loading, setLoading] = useState(true);

  const [currentCycle, setCurrentCycle] = useState(null);
  const [archives, setArchives] = useState([]);
  const [syncStatus, setSyncStatus] = useState('محفوظ محلياً على الجهاز');

  const [cycleModalVisible, setCycleModalVisible] = useState(false);
  const [expenseModalVisible, setExpenseModalVisible] = useState(false);
  const [addFundsModalVisible, setAddFundsModalVisible] = useState(false);
  const [archiveModalVisible, setArchiveModalVisible] = useState(false);

  const now = new Date();
  const [initialBudgetInput, setInitialBudgetInput] = useState('');
  const [cycleTitleInput, setCycleTitleInput] = useState('');
  const [cycleDay, setCycleDay] = useState(now.getDate());
  const [cycleMonth, setCycleMonth] = useState(now.getMonth() + 1);
  const [cycleYear, setCycleYear] = useState(now.getFullYear());

  const [extraFundsInput, setExtraFundsInput] = useState('');
  const [extraFundsNote, setExtraFundsNote] = useState('');

  const [editingExpenseId, setEditingExpenseId] = useState(null);
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseCategory, setExpenseCategory] = useState('مواصلات');
  const [expenseDetails, setExpenseDetails] = useState('');

  useEffect(() => {
    loadLocalData();
  }, []);

  const loadLocalData = async () => {
    try {
      const localData = await AsyncStorage.getItem(STORAGE_KEY);
      if (localData) {
        const parsed = JSON.parse(localData);
        setCurrentCycle(parsed.currentCycle || null);
        setArchives(parsed.archives || []);
      }
      setSyncStatus('محفوظ محلياً على الجهاز');
    } catch (e) {
      setSyncStatus('تعذر قراءة التخزين المحلي');
    } finally {
      setLoading(false);
    }
  };

  const saveData = async (newCycle, newArchives) => {
    const payload = {
      currentCycle: newCycle,
      archives: newArchives,
      updatedAt: new Date().toISOString()
    };
    setCurrentCycle(newCycle);
    setArchives(newArchives);
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
      setSyncStatus('محفوظ محلياً على الجهاز');
    } catch (e) {
      setSyncStatus('خطأ أثناء الحفظ المحلي');
    }
  };

  const formatDate = (isoString) => {
    const d = new Date(isoString);
    return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()} -${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`; };  const formatShortDate = (isoString) => { const d = new Date(isoString); return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
  };

  const openCycleModal = () => {
    const today = new Date();
    setCycleDay(today.getDate());
    setCycleMonth(today.getMonth() + 1);
    setCycleYear(today.getFullYear());
    setInitialBudgetInput('');
    setCycleTitleInput('');
    setCycleModalVisible(true);
  };

  const adjustDay = (delta) => {
    const maxDay = new Date(cycleYear, cycleMonth, 0).getDate();
    let next = cycleDay + delta;
    if (next < 1) next = maxDay;
    if (next > maxDay) next = 1;
    setCycleDay(next);
  };

  const adjustMonth = (delta) => {
    let next = cycleMonth + delta;
    let nextYear = cycleYear;
    if (next < 1) {
      next = 12;
      nextYear -= 1;
    } else if (next > 12) {
      next = 1;
      nextYear += 1;
    }
    const maxDay = new Date(nextYear, next, 0).getDate();
    setCycleYear(nextYear);
    setCycleMonth(next);
    if (cycleDay > maxDay) setCycleDay(maxDay);
  };

  const adjustYear = (delta) => {
    const nextYear = cycleYear + delta;
    const maxDay = new Date(nextYear, cycleMonth, 0).getDate();
    setCycleYear(nextYear);
    if (cycleDay > maxDay) setCycleDay(maxDay);
  };

  const startNewCycle = () => {
    const budget = parseFloat(initialBudgetInput);
    if (isNaN(budget) || budget <= 0) {
      Alert.alert('تنبيه', 'اكتب مبلغ أساسي صحيح أكبر من الصفر');
      return;
    }
    const chosenDate = new Date(cycleYear, cycleMonth - 1, cycleDay, 12, 0, 0);
    const newCycle = {
      id: Date.now().toString(),
      title: cycleTitleInput.trim() || `دورة ${cycleDay}/${cycleMonth}`,
      startDate: chosenDate.toISOString(),
      totalBudget: budget,
      transactions: []
    };
    saveData(newCycle, archives);
    setInitialBudgetInput('');
    setCycleTitleInput('');
    setCycleModalVisible(false);
  };

  const handleAddFunds = () => {
    const amount = parseFloat(extraFundsInput);
    if (isNaN(amount) || amount <= 0) {
      Alert.alert('تنبيه', 'اكتب مبلغ إضافي صحيح');
      return;
    }
    const newTx = {
      id: Date.now().toString(),
      type: 'income',
      amount: amount,
      category: 'رصيد إضافي',
      details: extraFundsNote.trim(),
      description: extraFundsNote.trim() || 'إضافة رصيد إضافي',
      date: new Date().toISOString()
    };
    const updatedCycle = {
      ...currentCycle,
      totalBudget: currentCycle.totalBudget + amount,
      transactions: [newTx, ...currentCycle.transactions]
    };
    saveData(updatedCycle, archives);
    setExtraFundsInput('');
    setExtraFundsNote('');
    setAddFundsModalVisible(false);
  };

  const buildExpenseLabel = (category, details) => {
    const cleanDetails = (details || '').trim();
    return cleanDetails ? `${category} -${cleanDetails}` : category;
  };

  const saveExpense = () => {
    const amount = parseFloat(expenseAmount);
    if (isNaN(amount) || amount <= 0) {
      Alert.alert('تنبيه', 'اكتب مبلغ صحيح');
      return;
    }

    const finalCategory = expenseCategory || 'أخرى';
    const cleanDetails = expenseDetails.trim();
    const label = buildExpenseLabel(finalCategory, cleanDetails);

    let updatedTransactions;
    if (editingExpenseId) {
      updatedTransactions = currentCycle.transactions.map(t =>
        t.id === editingExpenseId
          ? { ...t, amount, category: finalCategory, details: cleanDetails, description: label }
          : t
      );
    } else {
      const newTx = {
        id: Date.now().toString(),
        type: 'expense',
        amount,
        category: finalCategory,
        details: cleanDetails,
        description: label,
        date: new Date().toISOString()
      };
      updatedTransactions = [newTx, ...currentCycle.transactions];
    }

    saveData({ ...currentCycle, transactions: updatedTransactions }, archives);
    setExpenseAmount('');
    setExpenseDetails('');
    setEditingExpenseId(null);
    setExpenseModalVisible(false);
  };

  const openNewExpense = () => {
    setEditingExpenseId(null);
    setExpenseAmount('');
    setExpenseCategory('مواصلات');
    setExpenseDetails('');
    setExpenseModalVisible(true);
  };

  const openEditExpense = (item) => {
    if (item.type === 'income') return;
    setEditingExpenseId(item.id);
    setExpenseAmount(item.amount.toString());
    const matchedCat = CATEGORIES.includes(item.category) ? item.category : 'أخرى';
    setExpenseCategory(matchedCat);
    setExpenseDetails(item.details !== undefined ? item.details : '');
    setExpenseModalVisible(true);
  };

  const deleteTransaction = (item) => {
    Alert.alert('حذف العملية', 'هل أنت متأكد من حذف هذه العملية؟', [
      { text: 'إلغاء', style: 'cancel' },
      {
        text: 'حذف',
        style: 'destructive',
        onPress: () => {
          const newBudget = item.type === 'income'
            ? currentCycle.totalBudget - item.amount
            : currentCycle.totalBudget;
          const filtered = currentCycle.transactions.filter(t => t.id !== item.id);
          saveData({ ...currentCycle, totalBudget: newBudget, transactions: filtered }, archives);
        }
      }
    ]);
  };

  const totalSpent = currentCycle
    ? currentCycle.transactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0)
    : 0;
  const remaining = currentCycle ? currentCycle.totalBudget - totalSpent : 0;

  const categoryTotals = currentCycle
    ? CATEGORIES.map(cat => {
        const sum = currentCycle.transactions
          .filter(t => t.type === 'expense' && (t.category === cat || (!t.category && t.description?.startsWith(cat))))
          .reduce((acc, t) => acc + t.amount, 0);
        return { category: cat, total: sum };
      }).filter(c => c.total > 0)
    : [];

  const daysPassed = currentCycle
    ? Math.max(1, Math.ceil((new Date() - new Date(currentCycle.startDate)) / (1000 * 60 * 60 * 24)))
    : 1;
  const dailyAverage = (totalSpent / daysPassed).toFixed(1);

  const closeAndArchiveCycle = () => {
    Alert.alert(
      'إنهاء وأرشفة الدورة',
      'سيتم حفظ هذه الدورة في الأرشيف والبدء بدورة جديدة. هل أنت متأكد؟',
      [
        { text: 'إلغاء', style: 'cancel' },
        {
          text: 'نعم، أرشفة',
          onPress: () => {
            const archivedItem = {
              ...currentCycle,
              endDate: new Date().toISOString(),
              totalSpent,
              remaining
            };
            saveData(null, [archivedItem, ...archives]);
          }
        }
      ]
    );
  };

  const exportToPDF = async (cycleData) => {
    if (!cycleData) return;
    const spent = cycleData.transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
    const rem = cycleData.totalBudget - spent;

    const rowsHtml = cycleData.transactions.map(t => `
      <tr>
        <td>${t.description}${t.type === 'income' ? '(إضافة رصيد +)' : ''}</td>
        <td style="color: ${t.type === 'income' ? '#059669' : '#DC2626'}; font-weight: bold;">
          ${t.type === 'income' ? '+' : '-'}${t.amount} EGP
        </td>
        <td>${formatDate(t.date)}</td>
      </tr>
    `).join('');

    const html = `
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="utf-8" />
        <style>
          body { font-family: Arial, sans-serif; padding: 24px; color: #1F2937; }
          h1 { color: #059669; text-align: center; margin-bottom: 4px; }
          .subtitle { text-align: center; color: #6B7280; margin-bottom: 20px; }
          .summary { display: flex; justify-content: space-around; background: #ECFDF5; padding: 15px; border-radius: 10px; margin-bottom: 20px; border: 1px solid #A7F3D0; }
          .box { text-align: center; }
          .box-title { font-size: 13px; color: #4B5563; }
          .box-val { font-size: 20px; font-weight: bold; color: #065F46; margin-top: 4px; }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; }
          th, td { border: 1px solid #E5E7EB; padding: 10px; text-align: right; font-size: 14px; }
          th { background-color: #10B981; color: white; }
        </style>
      </head>
      <body>
        <h1>تقرير مدير محفظة مصروفاتي</h1>
        <div class="subtitle">${cycleData.title} \vert{} من ${formatShortDate(cycleData.startDate)}</div>
        <div class="summary">
          <div class="box"><div class="box-title">إجمالي الميزانية</div><div
