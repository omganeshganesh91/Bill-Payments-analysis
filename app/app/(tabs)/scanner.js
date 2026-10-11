import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView,
  TextInput, ActivityIndicator, Platform, Animated, Dimensions
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useBills, useCategories } from '../../src/hooks/useApi';
import api from '../../src/config/api';
import { runOCR, extractBillData } from '../../src/services/ocr';
import { COLORS, SIZES, SHADOWS, FONTS, rs } from '../../src/constants/theme';

const { width: W } = Dimensions.get('window');

// ─── Animated floating avatar ────────────────────────────────
function FloatingAvatar({ state }) {
  const floatAnim  = useRef(new Animated.Value(0)).current;
  const scaleAnim  = useRef(new Animated.Value(1)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Float up-down loop
    Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, { toValue: -10, duration: 1600, useNativeDriver: true }),
        Animated.timing(floatAnim, { toValue: 0,   duration: 1600, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  useEffect(() => {
    if (state === 'processing') {
      // Bounce animation while scanning
      Animated.loop(
        Animated.sequence([
          Animated.timing(scaleAnim, { toValue: 1.1, duration: 400, useNativeDriver: true }),
          Animated.timing(scaleAnim, { toValue: 1.0, duration: 400, useNativeDriver: true }),
        ])
      ).start();
    } else if (state === 'done') {
      // Celebrate spin
      Animated.sequence([
        Animated.timing(rotateAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
        Animated.timing(rotateAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
      ]).start();
      Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true }).start();
    } else {
      scaleAnim.setValue(1);
    }
  }, [state]);

  const spin = rotateAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '20deg'] });

  const avatarFace = {
    idle:       '🧑‍💼',
    processing: '🔍',
    done:       '🎉',
    error:      '😅',
  }[state] || '🧑‍💼';

  const speechBubble = {
    idle:       'Scan or upload a bill — I\'ll read it for you!',
    processing: 'Reading your bill... give me a sec!',
    done:       'Got it! Review the details below.',
    error:      'Hmm, try a clearer image!',
  }[state] || '';

  return (
    <View style={styles.avatarWrap}>
      <Animated.View style={[styles.avatarContainer, { transform: [{ translateY: floatAnim }, { scale: scaleAnim }, { rotate: spin }] }]}>
        {/* Body */}
        <View style={styles.avatarBody}>
          <View style={styles.avatarHead}>
            <Text style={styles.avatarEmoji}>{avatarFace}</Text>
          </View>
          {/* Shirt / torso */}
          <View style={styles.avatarTorso}>
            <View style={[styles.avatarTorsoInner, { backgroundColor: state === 'processing' ? COLORS.warning : COLORS.primary }]}>
              <Text style={styles.avatarTorsoIcon}>📋</Text>
            </View>
          </View>
          {/* Shadow */}
          <View style={styles.avatarShadow} />
        </View>
      </Animated.View>
      {/* Speech bubble */}
      <View style={styles.speechBubble}>
        <Text style={styles.speechText}>{speechBubble}</Text>
        <View style={styles.speechTail} />
      </View>
    </View>
  );
}

// ─── Web Camera Component (uses browser getUserMedia) ─────────
function WebCamera({ onCapture, onClose }) {
  const videoRef   = useRef(null);
  const canvasRef  = useRef(null);
  const streamRef  = useRef(null);
  const [ready, setReady]     = useState(false);
  const [error, setError]     = useState(null);

  useEffect(() => {
    startCamera();
    return () => stopCamera();
  }, []);

  async function startCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current.play();
          setReady(true);
        };
      }
    } catch (err) {
      setError('Camera access denied. Please allow camera in browser settings.');
    }
  }

  function stopCamera() {
    streamRef.current?.getTracks().forEach(t => t.stop());
  }

  function capture() {
    if (!videoRef.current || !canvasRef.current) return;
    const video  = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width  = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    stopCamera();
    onCapture(dataUrl);
  }

  // Web-only — render HTML elements via dangerouslySetInnerHTML equivalent
  if (Platform.OS !== 'web') return null;

  if (error) {
    return (
      <View style={styles.camError}>
        <Text style={{ fontSize: rs(36) }}>📷</Text>
        <Text style={styles.camErrorText}>{error}</Text>
        <TouchableOpacity style={styles.camCloseBtn} onPress={onClose}>
          <Text style={styles.camCloseBtnText}>Use Gallery Instead</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.webCamWrap}>
      {/* Use a raw web video element inside a View — works via RNW */}
      <view style={{ position: 'relative', width: '100%', aspectRatio: '4/3', backgroundColor: '#000', borderRadius: rs(16), overflow: 'hidden' }}>
        <video ref={videoRef} autoPlay playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        <canvas ref={canvasRef} style={{ display: 'none' }} />
        {/* Scan frame overlay */}
        <view style={{
          position: 'absolute', inset: '12%', border: `3px solid ${COLORS.primary}`,
          borderRadius: '12px', boxShadow: `0 0 0 2000px rgba(0,0,0,0.45)`,
          pointerEvents: 'none',
        }}>
          {/* Corner accents */}
          {['topLeft','topRight','bottomLeft','bottomRight'].map(pos => (
            <view key={pos} style={{
              position: 'absolute',
              width: '24px', height: '24px',
              borderColor: COLORS.primary,
              ...(pos.includes('top')    ? { top: '-3px' }    : { bottom: '-3px' }),
              ...(pos.includes('Left')   ? { left: '-3px' }   : { right: '-3px' }),
              borderTopWidth:    pos.includes('top')    ? '4px' : '0',
              borderBottomWidth: pos.includes('bottom') ? '4px' : '0',
              borderLeftWidth:   pos.includes('Left')   ? '4px' : '0',
              borderRightWidth:  pos.includes('Right')  ? '4px' : '0',
            }} />
          ))}
        </view>
      </view>
      {!ready && <ActivityIndicator color={COLORS.primary} style={{ marginTop: rs(12) }} />}
      <View style={styles.camControls}>
        <TouchableOpacity style={styles.camCancelBtn} onPress={() => { stopCamera(); onClose(); }}>
          <Text style={styles.camCancelText}>✕ Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.camCaptureBtn, !ready && { opacity: 0.4 }]} onPress={capture} disabled={!ready}>
          <View style={styles.camCaptureBtnInner} />
        </TouchableOpacity>
        <View style={{ width: rs(80) }} />
      </View>
    </View>
  );
}

// ─── OCR Progress Indicator ───────────────────────────────────
function OCRProgress({ step, progress }) {
  const steps = [
    { key: 'loading',    label: 'Loading OCR engine...' },
    { key: 'scanning',   label: 'Scanning image...' },
    { key: 'reading',    label: 'Reading text...' },
    { key: 'extracting', label: 'Extracting bill data...' },
    { key: 'ai',         label: 'AI classifying category...' },
    { key: 'done',       label: 'Done!' },
  ];
  const progAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(progAnim, { toValue: progress, duration: 300, useNativeDriver: false }).start();
  }, [progress]);
  const barWidth = progAnim.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] });

  return (
    <View style={styles.ocrProgress}>
      <Text style={styles.ocrStep}>{steps.find(s => s.key === step)?.label || 'Processing...'}</Text>
      <View style={styles.ocrBarBg}>
        <Animated.View style={[styles.ocrBarFill, { width: barWidth }]} />
      </View>
      <Text style={styles.ocrPct}>{progress}%</Text>
    </View>
  );
}

// ─── Bill Form ────────────────────────────────────────────────
function BillForm({ data, categories, onSave, onCancel, saving }) {
  const [form, setForm] = useState({
    title:          data?.title    || '',
    vendor:         data?.vendor   || '',
    amount:         data?.amount   ? String(data.amount) : '',
    bill_date:      data?.billDate || new Date().toISOString().split('T')[0],
    due_date:       data?.dueDate  || '',
    category_id:    data?.suggestedCategoryId || '',
    notes:          '',
    payment_method: '',
    image_uri:      data?.imageUri || '',
    scanned_text:   data?.rawText  || '',
    tags:           [],
  });
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: COLORS.background }}
      contentContainerStyle={{ padding: rs(16), paddingBottom: rs(60) }}
      showsVerticalScrollIndicator={false}
    >
      {data?.suggestedCategoryName && (
        <View style={styles.aiBanner}>
          <Text style={styles.aiBannerText}>
            🤖 AI detected: {data.suggestedCategoryName} ({data.dnaConfidence}% confident)
          </Text>
        </View>
      )}

      {[
        { label: 'Title *',   key: 'title',    placeholder: 'e.g. Electricity Bill March' },
        { label: 'Vendor',    key: 'vendor',   placeholder: 'e.g. BESCOM, Big Bazaar' },
      ].map(f => (
        <View key={f.key} style={styles.field}>
          <Text style={styles.fieldLabel}>{f.label}</Text>
          <TextInput style={styles.input} value={form[f.key]} onChangeText={v => set(f.key, v)} placeholder={f.placeholder} placeholderTextColor={COLORS.textLight} />
        </View>
      ))}

      <View style={{ flexDirection: 'row', gap: rs(10) }}>
        <View style={[styles.field, { flex: 1 }]}>
          <Text style={styles.fieldLabel}>Amount (₹) *</Text>
          <TextInput style={styles.input} value={form.amount} onChangeText={v => set('amount', v)} keyboardType="numeric" placeholder="0.00" placeholderTextColor={COLORS.textLight} />
        </View>
        <View style={[styles.field, { flex: 1 }]}>
          <Text style={styles.fieldLabel}>Bill Date</Text>
          <TextInput style={styles.input} value={form.bill_date} onChangeText={v => set('bill_date', v)} placeholder="YYYY-MM-DD" placeholderTextColor={COLORS.textLight} />
        </View>
      </View>

      {form.amount ? (
        <View style={styles.totalPreview}>
          <Text style={styles.totalPreviewText}>Total: ₹{(parseFloat(form.amount)||0).toLocaleString('en-IN')}</Text>
        </View>
      ) : null}

      <View style={styles.field}>
        <Text style={styles.fieldLabel}>Due Date</Text>
        <TextInput style={styles.input} value={form.due_date} onChangeText={v => set('due_date', v)} placeholder="YYYY-MM-DD (optional)" placeholderTextColor={COLORS.textLight} />
      </View>

      <View style={styles.field}>
        <Text style={styles.fieldLabel}>Category {data?.suggestedCategoryId ? '✨ AI suggested' : ''}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {categories.map(cat => (
            <TouchableOpacity
              key={cat.id}
              style={[styles.chip, form.category_id === cat.id && { borderColor: cat.color, backgroundColor: cat.color + '18' }]}
              onPress={() => set('category_id', form.category_id === cat.id ? '' : cat.id)}
            >
              <Text style={{ fontSize: rs(14) }}>{cat.icon}</Text>
              <Text style={[styles.chipText, form.category_id === cat.id && { color: cat.color, fontWeight: '800' }]}>{cat.name}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <View style={styles.field}>
        <Text style={styles.fieldLabel}>Payment</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {['Cash','UPI','Card','Net Banking','Cheque'].map(m => (
            <TouchableOpacity key={m} style={[styles.chip, form.payment_method===m && styles.chipActive]} onPress={() => set('payment_method', m===form.payment_method?'':m)}>
              <Text style={[styles.chipText, form.payment_method===m && { color: COLORS.primary }]}>{m}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <View style={styles.field}>
        <Text style={styles.fieldLabel}>Tags</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {['#warranty','#tax-deductible','#reimbursable','#recurring'].map(tag => {
            const active = form.tags.includes(tag);
            return (
              <TouchableOpacity key={tag} style={[styles.chip, active && styles.chipActive]}
                onPress={() => set('tags', active ? form.tags.filter(t=>t!==tag) : [...form.tags, tag])}>
                <Text style={[styles.chipText, active && { color: COLORS.primary }]}>{tag}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <View style={styles.field}>
        <Text style={styles.fieldLabel}>Notes</Text>
        <TextInput style={[styles.input, { height: rs(70), textAlignVertical: 'top' }]}
          value={form.notes} onChangeText={v => set('notes', v)} multiline
          placeholder="e.g. 1 year warranty, tax receipt..." placeholderTextColor={COLORS.textLight} />
      </View>

      <View style={{ flexDirection: 'row', gap: rs(10), marginTop: rs(8) }}>
        <TouchableOpacity style={styles.cancelBtn} onPress={onCancel}>
          <Text style={styles.cancelBtnText}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.saveBtn, saving && { opacity: 0.6 }]} onPress={() => onSave(form)} disabled={saving}>
          {saving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.saveBtnText}>💾 Save Bill</Text>}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

// ─── Main Scanner Screen ──────────────────────────────────────
export default function ScannerScreen() {
  const router = useRouter();
  const [mode,          setMode]          = useState('home');     // home | webcam | processing | form
  const [avatarState,   setAvatarState]   = useState('idle');
  const [ocrStep,       setOcrStep]       = useState('loading');
  const [ocrProgress,   setOcrProgress]   = useState(0);
  const [extractedData, setExtractedData] = useState(null);
  const [saving,        setSaving]        = useState(false);

  const { createBill } = useBills();
  const { categories, fetchCategories } = useCategories();
  useEffect(() => { fetchCategories(); }, []);

  const processImage = useCallback(async (imageSource) => {
    setMode('processing');
    setAvatarState('processing');
    setOcrProgress(5);

    try {
      // Run real OCR
      const rawText = await runOCR(imageSource, ({ status, progress }) => {
        setOcrProgress(progress);
        if (status.includes('Loading'))    setOcrStep('loading');
        else if (status.includes('Scan'))  setOcrStep('scanning');
        else if (status.includes('Read'))  setOcrStep('reading');
        else                               setOcrStep('extracting');
      });

      setOcrStep('extracting');
      setOcrProgress(90);

      // Extract structured data
      let data = extractBillData(rawText);
      data.imageUri = imageSource;

      setOcrStep('ai');
      setOcrProgress(95);

      // Bill DNA auto-category
      try {
        const dnaRes = await api.post('/ai/bill-dna', { title: data.title, vendor: data.vendor, amount: data.amount });
        if (dnaRes?.success && dnaRes.data?.suggested_category) {
          data.suggestedCategoryId   = dnaRes.data.suggested_category.id;
          data.suggestedCategoryName = dnaRes.data.suggested_category.name;
          data.dnaConfidence         = dnaRes.data.confidence;
        }
      } catch (_) {}

      setOcrProgress(100);
      setOcrStep('done');
      setExtractedData(data);
      setAvatarState('done');
    } catch (err) {
      setAvatarState('error');
      Alert.alert('Scan Error', err.message || 'Could not process image');
      setMode('home');
    }
  }, []);

  // ── Gallery picker ────────────────────────────────────────────
  const pickFromGallery = useCallback(async () => {
    try {
      if (Platform.OS !== 'web') {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission Required', 'Please allow gallery access.');
          return;
        }
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true, aspect: [4, 3], quality: 0.85,
        base64: Platform.OS === 'web',
      });
      if (!result.canceled && result.assets?.[0]) {
        const asset = result.assets[0];
        const src = Platform.OS === 'web'
          ? `data:image/jpeg;base64,${asset.base64}`
          : asset.uri;
        await processImage(src);
      }
    } catch (err) {
      Alert.alert('Error', 'Could not open gallery: ' + err.message);
    }
  }, [processImage]);

  // ── Native camera (mobile only) ──────────────────────────────
  const takeNativePhoto = useCallback(async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') { Alert.alert('Permission Required', 'Camera access needed.'); return; }
      const result = await ImagePicker.launchCameraAsync({ allowsEditing: true, aspect: [4, 3], quality: 0.85 });
      if (!result.canceled && result.assets?.[0]) await processImage(result.assets[0].uri);
    } catch (err) {
      Alert.alert('Error', err.message);
    }
  }, [processImage]);

  const handleSave = useCallback(async (formData) => {
    if (!formData.title?.trim())  { Alert.alert('Required', 'Please enter a title');         return; }
    if (!formData.amount || isNaN(parseFloat(formData.amount))) { Alert.alert('Required', 'Enter a valid amount'); return; }
    setSaving(true);
    try {
      await createBill({ ...formData, amount: parseFloat(formData.amount), tax_amount: 0, is_recurring: 0, tags: formData.tags || [] });
      Alert.alert('✅ Saved!', 'Bill saved successfully.', [
        { text: 'View Bills',   onPress: () => { setMode('home'); router.push('/(tabs)/bills'); } },
        { text: 'Scan Another', onPress: () => { setMode('home'); setExtractedData(null); setAvatarState('idle'); } },
      ]);
    } catch (err) {
      Alert.alert('Error', err.message);
    } finally {
      setSaving(false);
    }
  }, [createBill, router]);

  // ── Web camera mode ──────────────────────────────────────────
  if (mode === 'webcam' && Platform.OS === 'web') {
    return (
      <View style={styles.screen}>
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => setMode('home')}><Text style={styles.topBarBack}>✕</Text></TouchableOpacity>
          <Text style={styles.topBarTitle}>📷 Live Camera</Text>
          <View style={{ width: rs(40) }} />
        </View>
        <WebCamera
          onCapture={uri => processImage(uri)}
          onClose={() => setMode('home')}
        />
      </View>
    );
  }

  // ── Processing mode ──────────────────────────────────────────
  if (mode === 'processing') {
    return (
      <View style={styles.screen}>
        <View style={styles.topBar}>
          <View style={{ width: rs(40) }} />
          <Text style={styles.topBarTitle}>Reading Bill</Text>
          <View style={{ width: rs(40) }} />
        </View>
        <ScrollView contentContainerStyle={styles.processingContent} showsVerticalScrollIndicator={false}>
          <FloatingAvatar state={avatarState} />
          <OCRProgress step={ocrStep} progress={ocrProgress} />

          {ocrProgress === 100 && extractedData && (
            <Animated.View style={styles.extractedCard}>
              <Text style={styles.extractedTitle}>✅ Extracted Successfully</Text>
              {[
                { label: '📄 Title',   value: extractedData.title,                     color: COLORS.text },
                { label: '🏪 Vendor',  value: extractedData.vendor || '—',             color: COLORS.text },
                { label: '💰 Amount',  value: `₹${(extractedData.amount||0).toLocaleString('en-IN')}`, color: COLORS.primary },
                { label: '📅 Date',    value: extractedData.billDate,                  color: COLORS.text },
                extractedData.dueDate && { label: '⏰ Due', value: extractedData.dueDate, color: COLORS.warning },
                extractedData.suggestedCategoryName && { label: '🤖 Category', value: `${extractedData.suggestedCategoryName} (${extractedData.dnaConfidence}%)`, color: COLORS.primary },
              ].filter(Boolean).map((row, i) => (
                <View key={i} style={styles.extractedRow}>
                  <Text style={styles.extractedKey}>{row.label}</Text>
                  <Text style={[styles.extractedVal, { color: row.color }]}>{row.value}</Text>
                </View>
              ))}
              <TouchableOpacity style={styles.proceedBtn} onPress={() => setMode('form')}>
                <Text style={styles.proceedBtnText}>Review & Save →</Text>
              </TouchableOpacity>
            </Animated.View>
          )}
        </ScrollView>
      </View>
    );
  }

  // ── Form mode ─────────────────────────────────────────────────
  if (mode === 'form') {
    return (
      <View style={styles.screen}>
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => setMode('home')}><Text style={styles.topBarBack}>✕</Text></TouchableOpacity>
          <Text style={styles.topBarTitle}>Bill Details</Text>
          <View style={{ width: rs(40) }} />
        </View>
        <BillForm data={extractedData} categories={categories} onSave={handleSave} onCancel={() => setMode('home')} saving={saving} />
      </View>
    );
  }

  // ── Home mode ─────────────────────────────────────────────────
  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>📷 Scan Bill</Text>
        <Text style={styles.headerSub}>AI reads your bill instantly</Text>
      </View>

      <ScrollView contentContainerStyle={styles.homeContent} showsVerticalScrollIndicator={false}>
        <FloatingAvatar state={avatarState} />

        {/* Action buttons */}
        <View style={styles.actionGrid}>
          {/* Camera — web shows live camera, native uses camera */}
          <TouchableOpacity
            style={[styles.actionCard, styles.actionCardPrimary]}
            onPress={() => Platform.OS === 'web' ? setMode('webcam') : takeNativePhoto()}
            activeOpacity={0.85}
          >
            <Text style={styles.actionCardEmoji}>📸</Text>
            <Text style={styles.actionCardTitle}>Take Photo</Text>
            <Text style={styles.actionCardSub}>
              {Platform.OS === 'web' ? 'Opens live webcam' : 'Opens camera app'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionCard, styles.actionCardGreen]}
            onPress={pickFromGallery}
            activeOpacity={0.85}
          >
            <Text style={styles.actionCardEmoji}>🖼️</Text>
            <Text style={styles.actionCardTitle}>Upload from Gallery</Text>
            <Text style={styles.actionCardSub}>Pick existing photo</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionCard, styles.actionCardOrange]}
            onPress={() => { setExtractedData(null); setMode('form'); }}
            activeOpacity={0.85}
          >
            <Text style={styles.actionCardEmoji}>✏️</Text>
            <Text style={styles.actionCardTitle}>Manual Entry</Text>
            <Text style={styles.actionCardSub}>Type details yourself</Text>
          </TouchableOpacity>
        </View>

        {/* How it works */}
        <View style={styles.howItWorks}>
          <Text style={styles.howTitle}>🤖 How AI Bill Scanning Works</Text>
          {[
            { n: '1', text: 'Photo or gallery image uploaded' },
            { n: '2', text: 'Tesseract OCR reads all text' },
            { n: '3', text: 'AI extracts amount, date, vendor' },
            { n: '4', text: 'Bill DNA auto-detects category' },
            { n: '5', text: 'You confirm and save in one tap' },
          ].map(s => (
            <View key={s.n} style={styles.howStep}>
              <View style={styles.howNum}><Text style={styles.howNumText}>{s.n}</Text></View>
              <Text style={styles.howText}>{s.text}</Text>
            </View>
          ))}
        </View>

        {/* Supported bills */}
        <View style={styles.supportedBox}>
          <Text style={styles.supportedTitle}>📋 Supported Bill Types</Text>
          <View style={styles.supportedGrid}>
            {['⚡ Electricity','💧 Water','🛒 Grocery','🏠 Rent','📶 Internet','📱 Mobile','🍽️ Food','🚗 Transport','🏥 Medical','🛡️ Insurance','📚 Education','🎬 Entertainment'].map(t => (
              <View key={t} style={styles.supportedChip}><Text style={styles.supportedChipText}>{t}</Text></View>
            ))}
          </View>
        </View>

        <View style={{ height: rs(32) }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.background },
  header: {
    backgroundColor: COLORS.primary,
    paddingTop: Platform.OS === 'ios' ? rs(54) : rs(44),
    paddingBottom: rs(20), paddingHorizontal: rs(20),
    borderBottomLeftRadius: rs(24), borderBottomRightRadius: rs(24),
  },
  headerTitle: { fontSize: FONTS.xxl, fontWeight: '900', color: '#fff' },
  headerSub:   { fontSize: FONTS.sm,  color: 'rgba(255,255,255,0.75)', marginTop: rs(2) },
  topBar: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: COLORS.primary,
    paddingTop: Platform.OS === 'ios' ? rs(54) : rs(44),
    paddingBottom: rs(16), paddingHorizontal: rs(20),
  },
  topBarBack:  { color: '#fff', fontSize: FONTS.lg, fontWeight: '700', minWidth: rs(40) },
  topBarTitle: { color: '#fff', fontSize: FONTS.lg, fontWeight: '800' },

  homeContent: { padding: rs(16) },

  // Avatar
  avatarWrap:      { alignItems: 'center', paddingVertical: rs(16) },
  avatarContainer: { alignItems: 'center' },
  avatarBody:      { alignItems: 'center' },
  avatarHead: {
    width: rs(80), height: rs(80), borderRadius: rs(40),
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 3, borderColor: COLORS.primaryMid,
    ...SHADOWS.md,
  },
  avatarEmoji: { fontSize: rs(44) },
  avatarTorso: { marginTop: rs(-6), alignItems: 'center' },
  avatarTorsoInner: {
    width: rs(64), height: rs(56), borderRadius: rs(16),
    alignItems: 'center', justifyContent: 'center',
    borderBottomLeftRadius: rs(24), borderBottomRightRadius: rs(24),
  },
  avatarTorsoIcon: { fontSize: rs(26), color: '#fff' },
  avatarShadow: {
    width: rs(60), height: rs(12), borderRadius: rs(30),
    backgroundColor: 'rgba(99,102,241,0.15)', marginTop: rs(6),
  },
  speechBubble: {
    backgroundColor: COLORS.card, borderRadius: rs(16), padding: rs(12),
    marginTop: rs(16), maxWidth: '85%',
    borderWidth: 1, borderColor: COLORS.border, ...SHADOWS.sm,
  },
  speechText: { fontSize: FONTS.sm, color: COLORS.text, fontWeight: '600', textAlign: 'center' },
  speechTail: {
    position: 'absolute', top: -rs(8), alignSelf: 'center',
    width: 0, height: 0,
    borderLeftWidth: rs(8), borderRightWidth: rs(8), borderBottomWidth: rs(8),
    borderLeftColor: 'transparent', borderRightColor: 'transparent', borderBottomColor: COLORS.border,
  },

  // Action cards
  actionGrid: { gap: rs(12), marginBottom: rs(16) },
  actionCard: {
    flexDirection: 'row', alignItems: 'center', gap: rs(14),
    borderRadius: rs(20), padding: rs(18), borderWidth: 2,
    ...SHADOWS.sm,
  },
  actionCardPrimary: { backgroundColor: COLORS.primaryLight, borderColor: COLORS.primary },
  actionCardGreen:   { backgroundColor: COLORS.successLight,  borderColor: COLORS.success },
  actionCardOrange:  { backgroundColor: COLORS.warningLight,  borderColor: COLORS.warning },
  actionCardEmoji:   { fontSize: rs(38) },
  actionCardTitle:   { fontSize: FONTS.md, fontWeight: '800', color: COLORS.text },
  actionCardSub:     { fontSize: FONTS.xs, color: COLORS.textSecondary, marginTop: rs(2) },

  // Processing
  processingContent: { padding: rs(16), alignItems: 'center' },
  ocrProgress: { width: '100%', marginTop: rs(8), marginBottom: rs(16) },
  ocrStep:     { fontSize: FONTS.sm, fontWeight: '700', color: COLORS.text, marginBottom: rs(8), textAlign: 'center' },
  ocrBarBg:    { height: rs(10), backgroundColor: COLORS.borderLight, borderRadius: rs(5), overflow: 'hidden' },
  ocrBarFill:  { height: '100%', backgroundColor: COLORS.primary, borderRadius: rs(5) },
  ocrPct:      { fontSize: FONTS.xs, color: COLORS.textSecondary, textAlign: 'right', marginTop: rs(4), fontWeight: '700' },
  extractedCard: {
    backgroundColor: COLORS.card, borderRadius: rs(20), padding: rs(16),
    width: '100%', ...SHADOWS.md, borderWidth: 1, borderColor: COLORS.borderLight,
  },
  extractedTitle:  { fontSize: FONTS.lg, fontWeight: '800', color: COLORS.success, marginBottom: rs(12) },
  extractedRow:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: rs(8), borderBottomWidth: 1, borderBottomColor: COLORS.borderLight },
  extractedKey:    { fontSize: FONTS.sm, color: COLORS.textSecondary, fontWeight: '600' },
  extractedVal:    { fontSize: FONTS.sm, fontWeight: '800', maxWidth: '58%', textAlign: 'right' },
  proceedBtn:      { marginTop: rs(16), backgroundColor: COLORS.primary, paddingVertical: rs(14), borderRadius: rs(28), alignItems: 'center', ...SHADOWS.lg },
  proceedBtnText:  { color: '#fff', fontWeight: '800', fontSize: FONTS.md },

  // Web camera
  webCamWrap:     { flex: 1, padding: rs(16) },
  camControls:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: rs(20), paddingHorizontal: rs(20) },
  camCaptureBtn:  { width: rs(72), height: rs(72), borderRadius: rs(36), borderWidth: 4, borderColor: COLORS.primary, alignItems: 'center', justifyContent: 'center', ...SHADOWS.md },
  camCaptureBtnInner: { width: rs(56), height: rs(56), borderRadius: rs(28), backgroundColor: COLORS.primary },
  camCancelBtn:   { backgroundColor: COLORS.card, paddingHorizontal: rs(16), paddingVertical: rs(10), borderRadius: rs(20), borderWidth: 1, borderColor: COLORS.border },
  camCancelText:  { fontSize: FONTS.sm, color: COLORS.textSecondary, fontWeight: '700' },
  camError:       { flex: 1, justifyContent: 'center', alignItems: 'center', padding: rs(32), gap: rs(16) },
  camErrorText:   { fontSize: FONTS.sm, color: COLORS.textSecondary, textAlign: 'center', lineHeight: rs(22) },
  camCloseBtn:    { backgroundColor: COLORS.primary, paddingHorizontal: rs(24), paddingVertical: rs(12), borderRadius: rs(24) },
  camCloseBtnText: { color: '#fff', fontWeight: '700', fontSize: FONTS.sm },

  // Form
  aiBanner:     { backgroundColor: COLORS.primaryLight, borderRadius: rs(12), padding: rs(10), marginBottom: rs(14) },
  aiBannerText: { color: COLORS.primary, fontSize: FONTS.sm, fontWeight: '700' },
  field:        { marginBottom: rs(14) },
  fieldLabel:   { fontSize: FONTS.xs, fontWeight: '700', color: COLORS.textSecondary, marginBottom: rs(6), textTransform: 'uppercase' },
  input: {
    backgroundColor: COLORS.card, borderRadius: rs(12), paddingHorizontal: rs(14), paddingVertical: rs(12),
    fontSize: FONTS.md, color: COLORS.text, borderWidth: 1.5, borderColor: COLORS.border,
  },
  totalPreview:     { backgroundColor: COLORS.primaryLight, padding: rs(10), borderRadius: rs(10), alignItems: 'center', marginBottom: rs(14) },
  totalPreviewText: { color: COLORS.primary, fontWeight: '800', fontSize: FONTS.md },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: rs(4),
    backgroundColor: COLORS.card, borderRadius: rs(20), paddingHorizontal: rs(12), paddingVertical: rs(8),
    borderWidth: 1.5, borderColor: COLORS.border, marginRight: rs(8),
  },
  chipActive:  { backgroundColor: COLORS.primaryLight, borderColor: COLORS.primary },
  chipText:    { fontSize: FONTS.xs, color: COLORS.textSecondary, fontWeight: '600' },
  cancelBtn:   { flex: 1, paddingVertical: rs(14), borderRadius: rs(28), alignItems: 'center', borderWidth: 1.5, borderColor: COLORS.border },
  cancelBtnText: { color: COLORS.textSecondary, fontWeight: '700', fontSize: FONTS.md },
  saveBtn:     { flex: 2, backgroundColor: COLORS.primary, paddingVertical: rs(14), borderRadius: rs(28), alignItems: 'center', ...SHADOWS.md },
  saveBtnText: { color: '#fff', fontWeight: '800', fontSize: FONTS.md },

  // How it works
  howItWorks:  { backgroundColor: COLORS.primaryLight, borderRadius: rs(18), padding: rs(16), marginBottom: rs(14) },
  howTitle:    { fontSize: FONTS.md, fontWeight: '800', color: COLORS.primary, marginBottom: rs(12) },
  howStep:     { flexDirection: 'row', alignItems: 'center', gap: rs(10), marginBottom: rs(8) },
  howNum:      { width: rs(28), height: rs(28), borderRadius: rs(14), backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
  howNumText:  { color: '#fff', fontSize: FONTS.xs, fontWeight: '800' },
  howText:     { fontSize: FONTS.sm, color: COLORS.text, flex: 1 },

  // Supported
  supportedBox:    { backgroundColor: COLORS.card, borderRadius: rs(18), padding: rs(16), marginBottom: rs(14), ...SHADOWS.sm },
  supportedTitle:  { fontSize: FONTS.sm, fontWeight: '800', color: COLORS.textSecondary, marginBottom: rs(10) },
  supportedGrid:   { flexDirection: 'row', flexWrap: 'wrap', gap: rs(6) },
  supportedChip:   { backgroundColor: COLORS.background, paddingHorizontal: rs(10), paddingVertical: rs(5), borderRadius: rs(10), borderWidth: 1, borderColor: COLORS.border },
  supportedChipText: { fontSize: FONTS.xs, color: COLORS.text },
});
