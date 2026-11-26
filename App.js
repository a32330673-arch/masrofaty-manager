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
const MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

export default function App() {
  const [loading, setLoading] = useState(true);

  // بيانات الدورة الحالية والأرشيف
  const [currentCycle, setCurrentCycle] = useState(null);
  const [archives, setArchives] = useState([]);
  const [syncStatus, setSyncStatus] = useState('محفوظ محلياً على الجهاز');

  // النوافذ المنبثقة (Modals)
  const [cycleModalVisible, setCycleModalVisible] = useState(false);
  const [expenseModalVisible, setExpenseModalVisible] = useState(false);
  const [addFundsModalVisible, setAddFundsModalVisible] = useState(false);
  const [archiveModalVisible, setArchiveModalVisible] = useState(false);

  // مدخلات بدء الدورة + تاريخ البداية (افتراضي اليوم)
  const now = new Date();
  const [initialBudgetInput, setInitialBudgetInput] = useState('');
  const [cycleTitleInput, setCycleTitleInput] = useState('');
  const [cycleDay, setCycleDay] = useState(now.getDate());
  const [cycleMonth, setCycleMonth] = useState(now.getMonth() + 1);
  const [cycleYear, setCycleYear] = useState(now.getFullYear());

  // مدخلات تزويد الرصيد
  const [extraFundsInput, setExtraFundsInput] = useState('');
  const [extraFundsNote, setExtraFundsNote] = useState('');

  // مدخلات إضافة / تعديل مصروف (قسم + تفاصيل فاضية)
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
    return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()} - ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  const formatShortDate = (isoString) => {
    const d = new Date(isoString);
    return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
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

  // بدء دورة جديدة بالتاريخ المختار
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

  // تزويد الرصيد في منتصف الدورة
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

  // بناء عنوان واضح للعملية من القسم والتفاصيل
  const buildExpenseLabel = (category, details) => {
    const cleanDetails = (details || '').trim();
    return cleanDetails ? `${category} - ${cleanDetails}` : category;
  };

  // حفظ مصروف جديد أو تعديل مصروف حالي
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

  // الحسابات المالية للدورة الحالية
  const totalSpent = currentCycle
    ? currentCycle.transactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0)
    : 0;
  const remaining = currentCycle ? currentCycle.totalBudget - totalSpent : 0;

  // تجميع المصاريف حسب الأقسام
  const categoryTotals = currentCycle
    ? CATEGORIES.map(cat => {
        const sum = currentCycle.transactions
          .filter(t => t.type === 'expense' && (t.category === cat || (!t.category && t.description?.startsWith(cat))))
          .reduce((acc, t) => acc + t.amount, 0);
        return { category: cat, total: sum };
      }).filter(c => c.total > 0)
    : [];

  // حساب متوسط الصرف اليومي
  const daysPassed = currentCycle
    ? Math.max(1, Math.ceil((new Date() - new Date(currentCycle.startDate)) / (1000 * 60 * 60 * 24)))
    : 1;
  const dailyAverage = (totalSpent / daysPassed).toFixed(1);

  // إغلاق الدورة وأرشفتها
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

  // تصدير التقرير بصيغة PDF
  const exportToPDF = async (cycleData) => {
    if (!cycleData) return;
    const spent = cycleData.transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
    const rem = cycleData.totalBudget - spent;

    const rowsHtml = cycleData.transactions.map(t => `
      <tr>
        <td>${t.description} ${t.type === 'income' ? '(إضافة رصيد +)' : ''}</td>
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
        <div class="subtitle">${cycleData.title} | من ${formatShortDate(cycleData.startDate)}</div>
        <div class="summary">
          <div class="box"><div class="box-title">إجمالي الميزانية</div><div class="box-val">${cycleData.totalBudget} EGP</div></div>
          <div class="box"><div class="box-title">إجمالي المصروف</div><div class="box-val" style="color:#DC2626;">${spent} EGP</div></div>
          <div class="box"><div class="box-title">المتبقي</div><div class="box-val">${rem} EGP</div></div>
        </div>
        <table>
          <thead>
            <tr>
              <th>البيان / الوصف</th>
              <th>المبلغ</th>
              <th>التاريخ والوقت</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml || '<tr><td colspan="3" style="text-align:center;">لا توجد عمليات مسجلة</td></tr>'}
          </tbody>
        </table>
      </body>
      </html>
    `;

    try {
      const { uri } = await Print.printToFileAsync({ html });
      await Sharing.shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });
    } catch (error) {
      Alert.alert('خطأ', 'تعذر إنشاء ملف PDF');
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#10B981" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F9FAFB" />

      {/* الشريط العلوي */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>مدير محفظة مصروفاتي</Text>
          <Text style={styles.syncText}>{syncStatus}</Text>
        </View>
        <TouchableOpacity style={styles.iconBtn} onPress={() => setArchiveModalVisible(true)}>
          <Text style={styles.iconBtnText}>الأرشيف ({archives.length})</Text>
        </TouchableOpacity>
      </View>

      {!currentCycle ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>لا توجد دورة مصاريف نشطة حالياً</Text>
          <Text style={styles.emptyDesc}>ابدأ دورة جديدة وحدد تاريخ البداية والمبلغ الأساسي</Text>
          <TouchableOpacity style={styles.primaryBtn} onPress={openCycleModal}>
            <Text style={styles.primaryBtnText}>+ بدء دورة جديدة</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={{ flex: 1 }}>
          {/* بطاقة الملخص المالي */}
          <View style={styles.summaryCard}>
            <View style={styles.cardTopRow}>
              <Text style={styles.cycleName}>
                {currentCycle.title} • تبدأ {formatShortDate(currentCycle.startDate)}
              </Text>
              <TouchableOpacity onPress={() => exportToPDF(currentCycle)} style={styles.pdfBtn}>
                <Text style={styles.pdfBtnText}>تصدير PDF</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.remainingLabel}>المتبقي معك الآن</Text>
            <Text style={[styles.remainingAmount, remaining < 0 && { color: '#FCA5A5' }]}>
              {remaining} <Text style={{ fontSize: 18 }}>EGP</Text>
            </Text>

            <Text style={styles.avgText}>
              متوسط صرفك اليومي: {dailyAverage} EGP (منذ {daysPassed} يوم)
            </Text>

            <View style={styles.statsRow}>
              <View style={styles.statBox}>
                <Text style={styles.statLabel}>الميزانية الكلية</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={styles.statValue}>{currentCycle.totalBudget} EGP</Text>
                  <TouchableOpacity onPress={() => setAddFundsModalVisible(true)} style={styles.plusBadge}>
                    <Text style={styles.plusBadgeText}>+</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.statDivider} />

              <View style={styles.statBox}>
                <Text style={styles.statLabel}>إجمالي المصروف</Text>
                <Text style={styles.statValue}>{totalSpent} EGP</Text>
              </View>
            </View>
          </View>

          {/* ملخص الصرف حسب الأقسام */}
          {categoryTotals.length > 0 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style
 
