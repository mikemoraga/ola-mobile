"use client";
import { getData } from "@/utils/storage";
import { Picker } from "@react-native-picker/picker";
import axios from "axios";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Toast from "react-native-toast-message";

export default function ApplyForLoan() {
  const router = useRouter();

  const [amount, setAmount] = useState("");
  const [terms, setTerms] = useState("");
  const [amountOptions, setAmountOptions] = useState<number[]>([]);
  const [termOptions, setTermOptions] = useState<string[]>([]);
  const [monthlyAmort, setMonthlyAmort] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [uploadingPayslip, setUploadingPayslip] = useState(false);

  const [user, setUser] = useState<any>(null);
  const [computed, setComputed] = useState(false);
  const [loadingRefs, setLoadingRefs] = useState(true);

  const [step, setStep] = useState(1);
  const [payslip, setPayslip] = useState<DocumentPicker.DocumentPickerAsset | null>(null);

  // 🔑
  const [baseLoanRefId, setBaseLoanRefId] = useState<string | null>(null);
  const [finalFilename, setFinalFilename] = useState<string | null>(null);

  useEffect(() => {
    const fetchUserAndRefs = async () => {
      const storedUser = await getData("user");
      if (!storedUser) return;

      setUser(storedUser);

      const body = { USERNAME: storedUser.username, REFID: "", DEVICEID: "::1" };

      try {
        const [amtRes, termRes] = await Promise.all([
          axios.post(`${API_URL}api/OLMS/Reference/Loan/Amount`, body, {
            headers: { Authorization: `Bearer ${storedUser.token}` },
          }),
          axios.post(`${API_URL}api/OLMS/Reference/Loan/Term`, body, {
            headers: { Authorization: `Bearer ${storedUser.token}` },
          }),
        ]);

        setAmountOptions(amtRes.data.map((a: any) => a.AMT));
        setAmount(amtRes.data[0]?.AMT?.toString() || "");
        setTermOptions(termRes.data.map((t: any) => t.TRM));
        setTerms(termRes.data[0]?.TRM || "");
      } finally {
        setLoadingRefs(false);
      }
    };

    fetchUserAndRefs();
  }, []);

  const handleCompute = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const res = await axios.post(
        `${API_URL}api/OLMS/Loan/Calculator`,
        {
          PRINCIPAL: amount,
          TERMS: terms,
          USERNAME: user.username,
          DEVICEID: "::1",
        },
        { headers: { Authorization: `Bearer ${user.token}` } }
      );

      const amort = res.data?.[0]?.Monthly_Amortization;
      if (amort) {
        setMonthlyAmort(amort.toString());
        setComputed(true);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleApplyLoan = () => setStep(2);

  // =============================
  // PAYSLIP UPLOAD (GENERATE ID)
  // =============================
  const uploadPayslipFile = async (file: any) => {
    if (!user) return;

    try {
      setUploadingPayslip(true);

      let loanRefId = baseLoanRefId;

      if (!loanRefId) {
        const idRes = await axios.post(
          `${API_URL}api/OLMS/Reference/Loan/Id`,
          { USERNAME: user.username, DEVICEID: "::1" },
          { headers: { Authorization: `Bearer ${user.token}` } }
        );

        const actId = idRes.data?.[0]?.ACT_ID;
        if (!actId) {
          Toast.show({ type: "error", text1: "Failed to generate loan ID" });
          return;
        }

        const random = Math.floor(Math.random() * 9000000000) + 1000000000;
        loanRefId = `${actId}${random}`;
        setBaseLoanRefId(loanRefId);
      }

      const filename = `PAYSLIP_${loanRefId}.jpg`;
      setFinalFilename(filename);

      const ftpRef = await getData("ftpRef");
      if (!ftpRef) {
        Toast.show({ type: "error", text1: "FTP config missing" });
        return;
      }

      let fileBase64: string;
      try {
        fileBase64 = await FileSystem.readAsStringAsync(file.uri, {
          encoding: FileSystem.EncodingType.Base64,
        });
      } catch (e: any) {
        console.error("File read error:", e);
        Toast.show({ type: "error", text1: "Failed to read file", text2: e?.message });
        return;
      }

      await axios.post(
        `${API_URL}api/OLMS/Loan/SavingPayslipFTP`,
        {
          USERNAME: user.username,
          FILE_NAME_PAYSLIP: filename,
          FILE_PAYSLIP_BYTE: fileBase64,
          FTP_PATH: `${ftpRef.PATH.trimEnd("/")}/${filename}`,
          FTP_USER: ftpRef.USER,
          FTP_PWRD: ftpRef.PWRD,
          IP_ADDRESS: "::1",
          DEVICEID: "::1",
        },
        { headers: { Authorization: `Bearer ${user.token}` } }
      );

      setPayslip(file);
      Toast.show({ type: "success", text1: "Payslip uploaded" });

    } catch (e: any) {
      console.error("Upload error:", e);
      Toast.show({ type: "error", text1: "Upload failed", text2: e?.message || "Unknown error" });
    } finally {
      setUploadingPayslip(false);
    }
  };

  // =============================
  // SUBMIT LOAN (REUSE ID)
  // =============================
  const handleSubmitLoan = async () => {
    if (!baseLoanRefId || !finalFilename || !monthlyAmort) {
      Toast.show({ type: "error", text1: "Missing payslip or ID" });
      return;
    }

    try {
      setLoading(true);

      const ftpRef = await getData("ftpRef");

      // optional validation
      const valid = await axios.post(
        `${API_URL}api/OLMS/Loan/Validation/Id`,
        {
          USERNAME: user.username,
          ID: baseLoanRefId,
          DEVICEID: "::1",
        },
        { headers: { Authorization: `Bearer ${user.token}` } }
      );

      if (valid.data !== 0) {
        Toast.show({ type: "error", text1: "Loan ID exists" });
        return;
      }

      await axios.post(
        `${API_URL}api/OLMS/Loan/Application`,
        {
          USERNAME: user.username,
          LOAN_REF_ID: baseLoanRefId,
          TERMS: Number(terms),
          PRINCIPAL: Number(amount),
          M_AMORT: Number(monthlyAmort),
          FILE_NAME: finalFilename,
          FILE_PATH: `${ftpRef.PATH}${finalFilename}`,
          FILE_REASON: ftpRef.RSON,
          IP_ADDRESS: "::1",
          DEVICEID: "::1",
        },
        { headers: { Authorization: `Bearer ${user.token}` } }
      );

      Toast.show({ type: "success", text1: "Loan submitted" });

      // reset
      setBaseLoanRefId(null);
      setFinalFilename(null);
      setPayslip(null);
      setStep(1);
      setComputed(false);

      router.push({ pathname: "/(tabs)", params: { refresh: Date.now() } });
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setAmount(amountOptions[0]?.toString() || "");
    setTerms(termOptions[0] || "");
    setMonthlyAmort(null);
    setComputed(false);
  };

  const progress = step === 1 ? 0.2 : step === 2 ? 0.4 : 0.6;

  const handleGalleryPayslip = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["image/jpeg", "image/jpg"],
        copyToCacheDirectory: true,
      });

      if (result.canceled) return;

      const file = result.assets[0];
      await uploadPayslipFile(file);
    } catch (e) {
      Toast.show({ type: "error", text1: "Failed to pick file" });
    }
  };

  const handleCameraPayslip = async () => {
    if (!user) return;

    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== "granted") {
        Toast.show({ type: "error", text1: "Camera permission denied" });
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ["images"],
        quality: 0.8,
      });

      if (result.canceled) return;

      const asset = result.assets[0];
      if (!asset?.uri) {
        Toast.show({ type: "error", text1: "No image captured" });
        return;
      }

      const fileName = `camera_${Date.now()}.jpg`;
      const newPath = `${FileSystem.cacheDirectory}${fileName}`;

      await FileSystem.copyAsync({ from: asset.uri, to: newPath });

      await uploadPayslipFile({ uri: newPath, name: fileName });

    } catch (e: any) {
      console.error("Camera error:", e);
      Toast.show({ type: "error", text1: "Camera failed", text2: e?.message || "Unknown error" });
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>{step === 1 ? "Calculate Loan" : step === 2 ? "Loan Application" : "Approval"}</Text>
        <Text style={styles.cardSubtitle}>
          {step === 1
            ? <Text><Text style={{ color: "#ff5a5f", fontWeight: "bold" }}>Note:</Text> Select your desired
                loan amount and terms. For loans above ₱50,000, visit your branch. Compute to view your
                monthly amortization, then click Apply for Loan or Clear to reset.</Text>
            : step === 2
            ? <Text>You have to double check the details on loan application form below. Upload a copy of your latest payslip in JPG, JPEG format only. This will serve as a supporting document. Once settled, you may click Submit button to send your loan application.</Text>
            : <Text>Step 3: Approval in progress.</Text>}
        </Text>
      </View>

      <View style={{ marginHorizontal: 0 }}>
        {loadingRefs ? (
          <ActivityIndicator size="large" color="#ff5a5f" style={{ marginTop: 50 }} />
        ) : (
          <View style={styles.formCard}>
            <Text style={styles.label}>Requested Amount</Text>
            <View style={styles.pickerContainer}>
              <Picker selectedValue={amount} onValueChange={(v) => setAmount(v)} enabled={step === 1 && !computed}>
                {amountOptions.map((val) => (
                  <Picker.Item key={val} label={`₱${val.toLocaleString()}`} value={val.toString()} />
                ))}
              </Picker>
            </View>

            <Text style={styles.label}>Terms of Loan</Text>
            <View style={styles.pickerContainer}>
              <Picker selectedValue={terms} onValueChange={(v) => setTerms(v)} enabled={step === 1 && !computed}>
                {termOptions.map((val) => (
                  <Picker.Item key={val} label={`${val} months`} value={val} />
                ))}
              </Picker>
            </View>

            {monthlyAmort && (
              <View style={styles.amortBox}>
                <Text style={styles.label}>Monthly Amortization</Text>
                <Text style={styles.amortValue}>₱{parseFloat(monthlyAmort).toLocaleString()}</Text>
              </View>
            )}

            {step === 2 && (
              <>
                <Text style={styles.label}>Payslip</Text>
                <TouchableOpacity
                  style={[styles.uploadButton, uploadingPayslip && { opacity: 0.7 }]}
                    onPress={() =>
                      Alert.alert("Upload Payslip", "Choose source", [
                        { text: "Camera", onPress: handleCameraPayslip },
                        { text: "Files / Gallery", onPress: handleGalleryPayslip },
                        { text: "Cancel", style: "cancel" },
                      ])
                    }
                  disabled={uploadingPayslip} // disable while uploading
                >
                  <Text style={styles.buttonText}>
                    {uploadingPayslip ? "Uploading..." : payslip ? payslip.name : "Upload Payslip"}
                  </Text>
                </TouchableOpacity>
              </>
            )}

            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={[styles.computeButton, (loading || uploadingPayslip) && { opacity: 0.7 }]}
                onPress={step === 1
                  ? (computed ? handleApplyLoan : handleCompute)
                  : step === 2
                  ? handleSubmitLoan
                  : undefined}
                disabled={loading || uploadingPayslip}
              >
                {loading || uploadingPayslip ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.buttonText}>
                    {step === 1 ? (computed ? "Apply for Loan" : "Compute") : step === 2 ? "Submit" : "In Progress"}
                  </Text>
                )}
              </TouchableOpacity>

              {step === 1 && (
                <TouchableOpacity style={styles.clearButton} onPress={handleClear}>
                  <Text style={styles.buttonText}>Clear</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}
      </View>

      {/* Progress */}
      <View style={styles.progressCard}>
        <Text style={styles.progressText}>Completed {step - 1} step{step - 1 > 1 ? "s" : ""} out of 5</Text>
        <View style={styles.progressContainer}>
          <View style={styles.progressBackground}>
            <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
          </View>
          <View style={styles.progressLabels}>
            <Text style={[styles.progressLabel, { color: step > 1 ? "#4caf50" : "#ff9800" }]}>Calculation</Text>
            <Text style={[styles.progressLabel, { color: step > 2 ? "#4caf50" : step === 2 ? "#ff9800" : "#bbb" }]}>Payslip</Text>
            <Text style={[styles.progressLabel, { color: step > 3 ? "#4caf50" : step === 3 ? "#ff9800" : "#bbb" }]}>Approval</Text>
            <Text style={[styles.progressLabel, { color: step > 4 ? "#4caf50" : step === 4 ? "#ff9800" : "#bbb" }]}>Confirmation</Text>
            <Text style={[styles.progressLabel, { color: step === 5 ? "#ff9800" : "#bbb" }]}>Release</Text>
          </View>
        </View>

        <View style={styles.legendRow}>
          <Text style={[styles.legend, { color: "#4caf50" }]}>● Completed</Text>
          <Text style={[styles.legend, { color: "#ff9800" }]}>● In-Progress</Text>
          <Text style={[styles.legend, { color: "#bbb" }]}>● Not Started</Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: "#f2f2f2", flexGrow: 1 },
  cardHeader: { margin: 15, backgroundColor: "#fff", padding: 20, marginTop: 40, borderRadius: 12, marginBottom: 25, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 },
  cardTitle: { fontSize: 24, fontWeight: "bold", color: "#333", textAlign: "center", marginBottom: 10 },
  cardSubtitle: { fontSize: 14, color: "#333", textAlign: "justify" },
  formCard: { backgroundColor: "#fff", borderRadius: 12, borderWidth: 1, borderColor: "#ddd", padding: 20, marginHorizontal: 15, marginBottom: 5 },
  label: { fontSize: 14, fontWeight: "bold", marginBottom: 5, color: "#000" },
  pickerContainer: { borderWidth: 1, borderColor: "#ddd", borderRadius: 8, marginBottom: 15, overflow: "hidden", backgroundColor: "#fff" },
  amortBox: { backgroundColor: "#f9f9f9", borderRadius: 8, borderWidth: 1, borderColor: "#ddd", padding: 5, marginTop: 5, marginBottom: 20 },
  amortValue: { fontSize: 16, fontWeight: "bold", color: "#ff5a5f" },
  buttonRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 10 },
  computeButton: { flex: 1, backgroundColor: "#ff5a5f", paddingVertical: 14, borderRadius: 25, alignItems: "center", marginRight: 5 },
  clearButton: { flex: 1, backgroundColor: "#999", paddingVertical: 14, borderRadius: 25, alignItems: "center", marginLeft: 5 },
  uploadButton: { flex: 1, backgroundColor: "#ff5a5f", paddingVertical: 14, borderRadius: 25, alignItems: "center", marginTop: 5 },
  buttonText: { color: "#fff", fontWeight: "bold", fontSize: 15, textAlign: "center" },
  progressCard: { backgroundColor: "#fff", borderRadius: 12, borderWidth: 1, borderColor: "#ddd", padding: 20, marginHorizontal: 15, marginBottom: 50 },
  progressText: { textAlign: "center", fontSize: 14, fontWeight: "500", marginBottom: 10 },
  progressContainer: { marginBottom: 5 },
  progressBackground: { width: "100%", height: 10, backgroundColor: "#ddd", borderRadius: 5, overflow: "hidden" },
  progressFill: { height: "100%", backgroundColor: "#ff9800" },
  progressLabels: { flexDirection: "row", justifyContent: "space-between", marginTop: 8 },
  progressLabel: { fontSize: 10, textAlign: "center", flex: 1 },
  legendRow: { flexDirection: "row", justifyContent: "space-around", marginTop: 5 },
  legend: { fontSize: 12, fontWeight: "500" },
});
