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
    return cleanDetails ? `${category} - ${cleanDetails}` : category;
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

          {categoryTotals.length > 0 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.catSummaryScroll}
              contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
            >
              {categoryTotals.map((c) => (
                <View key={c.category} style={styles.catSummaryChip}>
                  <Text style={styles.catSummaryName}>{c.category}</Text>
                  <Text style={styles.catSummaryVal}>{c.total} EGP</Text>
                </View>
              ))}
            </ScrollView>
          )}

          <View style={styles.listHeader}>
            <Text style={styles.listTitle}>سجل العمليات ({currentCycle.transactions.length})</Text>
            <TouchableOpacity onPress={closeAndArchiveCycle}>
              <Text style={styles.closeCycleText}>إنهاء وأرشفة الدورة</Text>
            </TouchableOpacity>
          </View>

          <FlatList
            data={currentCycle.transactions}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ paddingBottom: 90 }}
            ListEmptyComponent={
              <Text style={styles.noTxText}>لم تسجل أي مصاريف بعد.. اضغط على الزر الأخضر بالأسفل للإضافة</Text>
            }
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.txItem}
                onPress={() => openEditExpense(item)}
                onLongPress={() => deleteTransaction(item)}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.txDesc}>{item.description}</Text>
                  <Text style={styles.txDate}>{formatDate(item.date)}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={[styles.txAmount, item.type === 'income' ? styles.incomeText : styles.expenseText]}>
                    {item.type === 'income' ? '+' : '-'}{item.amount} EGP
                  </Text>
                  <TouchableOpacity onPress={() => deleteTransaction(item)}>
                    <Text style={styles.deleteMini}>حذف</Text>
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            )}
          />

          <TouchableOpacity style={styles.fab} onPress={openNewExpense}>
            <Text style={styles.fabText}>+ تسجيل مصروف</Text>
          </TouchableOpacity>
        </View>
      )}

      <Modal visible={cycleModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>بدء دورة مصاريف جديدة</Text>
            <TextInput
              style={styles.input}
              placeholder="اسم الدورة (اختياري، مثلاً: مصروف شهر 12)"
              value={cycleTitleInput}
              onChangeText={setCycleTitleInput}
            />
            <TextInput
              style={styles.input}
              placeholder="المبلغ الأساسي (بالأرقام الإنجليزية)"
              value={initialBudgetInput}
              onChangeText={setInitialBudgetInput}
              keyboardType="numeric"
            />

            <Text style={styles.fieldLabel}>تاريخ بداية الدورة (الافتراضي: اليوم)</Text>
            <View style={styles.datePickerRow}>
              <View style={styles.dateUnitBox}>
                <Text style={styles.dateUnitLabel}>اليوم</Text>
                <View style={styles.dateControls}>
                  <TouchableOpacity style={styles.stepBtn} onPress={() => adjustDay(-1)}>
                    <Text style={styles.stepBtnText}>-</Text>
                  </TouchableOpacity>
                  <Text style={styles.dateVal}>{cycleDay}</Text>
                  <TouchableOpacity style={styles.stepBtn} onPress={() => adjustDay(1)}>
                    <Text style={styles.stepBtnText}>+</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.dateUnitBox}>
                <Text style={styles.dateUnitLabel}>الشهر</Text>
                <View style={styles.dateControls}>
                  <TouchableOpacity style={styles.stepBtn} onPress={() => adjustMonth(-1)}>
                    <Text style={styles.stepBtnText}>-</Text>
                  </TouchableOpacity>
                  <Text style={styles.dateVal}>{cycleMonth}</Text>
                  <TouchableOpacity style={styles.stepBtn} onPress={() => adjustMonth(1)}>
                    <Text style={styles.stepBtnText}>+</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.dateUnitBox}>
                <Text style={styles.dateUnitLabel}>السنة</Text>
                <View style={styles.dateControls}>
                  <TouchableOpacity style={styles.stepBtn} onPress={() => adjustYear(-1)}>
                    <Text style={styles.stepBtnText}>-</Text>
                  </TouchableOpacity>
                  <Text style={styles.dateVal}>{cycleYear}</Text>
                  <TouchableOpacity style={styles.stepBtn} onPress={() => adjustYear(1)}>
                    <Text style={styles.stepBtnText}>+</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setCycleModalVisible(false)}>
                <Text style={styles.cancelBtnText}>إلغاء</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={startNewCycle}>
                <Text style={styles.saveBtnText}>بدء الدورة</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={expenseModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>{editingExpenseId ? 'تعديل المصروف' : 'تسجيل مصروف جديد'}</Text>
            <TextInput
              style={styles.input}
              placeholder="المبلغ (مثلاً: 50)"
              value={expenseAmount}
              onChangeText={setExpenseAmount}
              keyboardType="numeric"
              autoFocus
            />

            <Text style={styles.fieldLabel}>اختر القسم</Text>
            <View style={styles.chipsWrap}>
              {CATEGORIES.map((cat) => {
                const active = expenseCategory === cat;
                return (
                  <TouchableOpacity
                    key={cat}
                    style={[styles.catChip, active && styles.catChipActive]}
                    onPress={() => setExpenseCategory(cat)}
                  >
                    <Text style={[styles.catChipText, active && styles.catChipTextActive]}>{cat}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <TextInput
              style={[styles.input, { marginTop: 12 }]}
              placeholder="نوع الفاتورة أو الأكل أو تفاصيل إضافية (اختياري)"
              value={expenseDetails}
              onChangeText={setExpenseDetails}
            />

            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setExpenseModalVisible(false)}>
                <Text style={styles.cancelBtnText}>إلغاء</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={saveExpense}>
                <Text style={styles.saveBtnText}>حفظ</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={addFundsModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>إضافة رصيد للدورة الحالية</Text>
            <TextInput
              style={styles.input}
              placeholder="المبلغ الإضافي"
              value={extraFundsInput}
              onChangeText={setExtraFundsInput}
              keyboardType="numeric"
              autoFocus
            />
            <TextInput
              style={styles.input}
              placeholder="ملاحظة (اختياري، مثلاً: تحويل إضافي)"
              value={extraFundsNote}
              onChangeText={setExtraFundsNote}
            />
            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setAddFundsModalVisible(false)}>
                <Text style={styles.cancelBtnText}>إلغاء</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={handleAddFunds}>
                <Text style={styles.saveBtnText}>إضافة للرصيد</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={archiveModalVisible} animationType="slide">
        <SafeAreaView style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>أرشيف الدورات السابقة</Text>
            <TouchableOpacity style={styles.iconBtn} onPress={() => setArchiveModalVisible(false)}>
              <Text style={styles.iconBtnText}>إغلاق</Text>
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ padding: 16 }}>
            {archives.length === 0 ? (
              <Text style={styles.noTxText}>لا توجد دورات مؤرشفة بعد</Text>
            ) : (
              archives.map((arc) => (
                <View key={arc.id} style={styles.archiveCard}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={styles.archiveTitle}>{arc.title}</Text>
                    <TouchableOpacity onPress={() => exportToPDF(arc)} style={styles.pdfBtnSmall}>
                      <Text style={{ color: '#059669', fontWeight: 'bold', fontSize: 12 }}>تصدير PDF</Text>
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.txDate}>من {formatDate(arc.startDate)} إلى {formatDate(arc.endDate)}</Text>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 }}>
                    <Text style={styles.archiveStat}>الميزانية: {arc.totalBudget} EGP</Text>
                    <Text style={styles.archiveStat}>المصروف: {arc.totalSpent} EGP</Text>
                    <Text style={styles.archiveStat}>المتبقي: {arc.remaining} EGP</Text>
                  </View>
                </View>
              ))
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  input: {
    backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 10,
    padding: 12, fontSize: 15, marginBottom: 12, textAlign: 'right', color: '#111827'
  },
  fieldLabel: {
    fontSize: 13, fontWeight: '700', color: '#374151', marginBottom: 8, textAlign: 'right'
  },
  primaryBtn: { backgroundColor: '#10B981', padding: 14, borderRadius: 10, alignItems: 'center' },
  primaryBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 16, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E5E7EB'
  },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#111827' },
  syncText: { fontSize: 12, color: '#10B981', marginTop: 2 },
  iconBtn: { backgroundColor: '#ECFDF5', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  iconBtnText: { color: '#059669', fontWeight: 'bold', fontSize: 13 },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  emptyTitle: { fontSize: 20, fontWeight: 'bold', color: '#1F2937', marginBottom: 8 },
  emptyDesc: { fontSize: 14, color: '#6B7280', textAlign: 'center', marginBottom: 24 },
  summaryCard: {
    backgroundColor: '#059669', marginHorizontal: 16, marginTop: 14, marginBottom: 10,
    borderRadius: 18, padding: 18, elevation: 4
  },
  cardTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  cycleName: { color: '#D1FAE5', fontSize: 14, fontWeight: 'bold' },
  pdfBtn: { backgroundColor: '#FFFFFF', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  pdfBtnText: { color: '#059669', fontWeight: 'bold', fontSize: 12 },
  remainingLabel: { color: '#A7F3D0', fontSize: 13, textAlign: 'center' },
  remainingAmount: { color: '#FFFFFF', fontSize: 36, fontWeight: 'bold', textAlign: 'center', marginVertical: 4 },
  avgText: { color: '#ECFDF5', fontSize: 12, textAlign: 'center', marginBottom: 14 },
  statsRow: {
    flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 12, padding: 12
  },
  statBox: { flex: 1, alignItems: 'center' },
  statDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.3)' },
  statLabel: { color: '#D1FAE5', fontSize: 12, marginBottom: 4 },
  statValue: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' },
  plusBadge: { backgroundColor: '#FFFFFF', width: 22, height: 22, borderRadius: 11, justifyContent: 'center', alignItems: 'center' },
  plusBadgeText: { color: '#059669', fontWeight: 'bold', fontSize: 15 },
  catSummaryScroll: { maxHeight: 54, marginBottom: 10 },
  catSummaryChip: {
    backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#D1FAE5', borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 6, justifyContent: 'center', alignItems: 'center'
  },
  catSummaryName: { fontSize: 11, color: '#059669', fontWeight: '700' },
  catSummaryVal: { fontSize: 13, color: '#111827', fontWeight: 'bold' },
  listHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, marginBottom: 8
  },
  listTitle: { fontSize: 16, fontWeight: 'bold', color: '#374151' },
  closeCycleText: { color: '#DC2626', fontSize: 13, fontWeight: '600' },
  noTxText: { textAlign: 'center', color: '#9CA3AF', marginTop: 40, paddingHorizontal: 20 },
  txItem: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: '#FFFFFF', marginHorizontal: 16, marginBottom: 10, padding: 14,
    borderRadius: 12, borderWidth: 1, borderColor: '#F3F4F6'
  },
  txDesc: { fontSize: 16, fontWeight: '600', color: '#1F2937', textAlign: 'right' },
  txDate: { fontSize: 12, color: '#9CA3AF', marginTop: 4, textAlign: 'right' },
  txAmount: { fontSize: 16, fontWeight: 'bold' },
  expenseText: { color: '#DC2626' },
  incomeText: { color: '#059669' },
  deleteMini: { color: '#9CA3AF', fontSize: 11, marginTop: 4 },
  fab: {
    position: 'absolute', bottom: 20, left: 20, right: 20, backgroundColor: '#10B981',
    padding: 16, borderRadius: 14, alignItems: 'center', elevation: 5
  },
  fabText: { color: '#FFFFFF', fontSize: 17, fontWeight: 'bold' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
  modalBox: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 20 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#111827', marginBottom: 16, textAlign: 'center' },
  datePickerRow: {
    flexDirection: 'row', justifyContent: 'space-between', gap: 8, marginBottom: 14
  },
  dateUnitBox: {
    flex: 1, backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB',
    borderRadius: 10, padding: 8, alignItems: 'center'
  },
  dateUnitLabel: { fontSize: 11, color: '#6B7280', marginBottom: 6, fontWeight: '600' },
  dateControls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%' },
  stepBtn: {
    backgroundColor: '#ECFDF5', width: 28, height: 28, borderRadius: 7,
    justifyContent: 'center', alignItems: 'center'
  },
  stepBtnText: { color: '#059669', fontWeight: 'bold', fontSize: 16 },
  dateVal: { fontSize: 14, fontWeight: 'bold', color: '#111827' },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  catChip: {
    backgroundColor: '#F3F4F6', paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: 20, borderWidth: 1, borderColor: '#E5E7EB'
  },
  catChipActive: { backgroundColor: '#ECFDF5', borderColor: '#10B981' },
  catChipText: { color: '#374151', fontSize: 13, fontWeight: '600' },
  catChipTextActive: { color: '#059669', fontWeight: 'bold' },
  modalBtns: { flexDirection: 'row', gap: 10, marginTop: 8 },
  cancelBtn: { flex: 1, backgroundColor: '#F3F4F6', padding: 12, borderRadius: 10, alignItems: 'center' },
  cancelBtnText: { color: '#4B5563', fontWeight: 'bold' },
  saveBtn: { flex: 1, backgroundColor: '#10B981', padding: 12, borderRadius: 10, alignItems: 'center' },
  saveBtnText: { color: '#FFFFFF', fontWeight: 'bold' },
  archiveCard: {
    backgroundColor: '#FFFFFF', padding: 16, borderRadius: 12, marginBottom: 12,
    borderWidth: 1, borderColor: '#E5E7EB'
  },
  archiveTitle: { fontSize: 16, fontWeight: 'bold', color: '#111827' },
  pdfBtnSmall: { backgroundColor: '#ECFDF5', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6 },
  archiveStat: { fontSize: 13, fontWeight: '600', color: '#374151' }
});
