"use client";

import { getData } from "@/utils/storage";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Picker } from "@react-native-picker/picker";
import axios from "axios";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import Toast from "react-native-toast-message";

export default function LoanConfirmation() {
  const router = useRouter();
  const { refid } = useLocalSearchParams<{ refid: string }>();

  const [showTermsModal, setShowTermsModal] = useState(false);
  const [terms, setTerms] = useState([false, false, false]);

  const [otp, setOtp] = useState("");
  const [selectedMethod, setSelectedMethod] = useState<"bank" | "cheque" | null>(null);
  const [loading, setLoading] = useState(false);

  const [appointmentDate, setAppointmentDate] = useState<Date>(new Date());
  const [showPicker, setShowPicker] = useState(false);

  const [proceedsOptions, setProceedsOptions] = useState<string[]>([]);
  const [timeSlots, setTimeSlots] = useState<any[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<any | null>(null);

  const netProceedsValue =
    selectedMethod === "bank"
      ? "Bank Crediting"
      : selectedMethod === "cheque"
      ? "Cheque"
      : null;

  useEffect(() => {
    fetchLoanType();
  }, []);

  // ================= OTP =================
  const sendOtp = async () => {
    try {
      const storedUser = await getData("user");

      await axios.post(
        `${API_URL}api/OLMS/User/Loan/Resubmission/Authentication`,
        {
          USERNAME: storedUser.username,
          PASSWORD: "",
          IPADDRESS: "",
          DEVICEID: "1",
        },
        {
          headers: {
            Authorization: `Bearer ${storedUser.token}`,
          },
        }
      );

      Toast.show({ type: "success", text1: "OTP sent" });
    } catch {
      Toast.show({ type: "error", text1: "Failed to send OTP" });
    }
  };

  // ================= LoanType =================
  const fetchLoanType = async () => {
    try {
      const storedUser = await getData("user");

      const res = await axios.post(
        `${API_URL}api/OLMS/Reference/LoanType`,
        {
          USERNAME: storedUser.username,
          REFID: refid,
          DEVICEID: "1",
        },
        {
          headers: {
            Authorization: `Bearer ${storedUser.token}`,
          },
        }
      );

      const list = res.data?.Proceeds || [];
      const mapped = list.map((x: any) => x.Description.toLowerCase());
      console.log("Proceeds options:", mapped);
      
      setProceedsOptions(mapped);
    } catch (err) {
      console.log("LoanType error:", err);
    }
  };

  // ================= Appointment Validation =================
  const validateAppointment = async (date: Date) => {
    try {
      const storedUser = await getData("user");

      const formatted = `${date.toISOString().split("T")[0]}T09:00:00`;

      const res = await axios.post(
        `${API_URL}api/OLMS/Appointment/Validation`,
        {
          AppointmentDate: formatted,
          USERNAME: storedUser.username,
          IpAddress: "1",
          DEVICEID: "1",
        },
        {
          headers: {
            Authorization: `Bearer ${storedUser.token}`,
          },
        }
      );

      setTimeSlots(res.data?.TimeReferences || []);
      setSelectedSlot(null);
    } catch (err) {
      console.log("Validation error:", err);
    }
  };

  // ================= Confirm =================
  const handleConfirm = async () => {
    if (
      !otp ||
      !selectedMethod ||
      (selectedMethod === "cheque" && (!appointmentDate || !selectedSlot))
    ) {
      Toast.show({
        type: "error",
        text1: "Complete all required fields",
      });
      return;
    }

    try {
      setLoading(true);

      const storedUser = await getData("user");

      const body = {
        USERNAME: storedUser.username,
        IPADDRESS: "",
        DEVICEID: "1",
        REFID_LOAN: refid,
        OTP: otp,
        STAT: "CON",
        APPT_DATE:
          selectedMethod === "cheque"
            ? `${appointmentDate.toISOString().split("T")[0]} 00:00:00`
            : "1900-01-01 00:00:00",
        APPT_CODE: selectedMethod === "cheque" ? selectedSlot?.Code : null,
        NETPROCEEDS: netProceedsValue,
      };

      const res = await axios.post(
        `${API_URL}api/OLMS/User/Loan/Resubmission/Verify`,
        body,
        {
          headers: {
            Authorization: `Bearer ${storedUser.token}`,
          },
        }
      );

      const code = res?.data?.[0]?.RESPONSE_CODE;

      if (code?.startsWith("L_")) {
        Toast.show({ type: "success", text1: "Loan confirmed" });
        router.replace("/(tabs)");
        return;
      }

      if (code?.startsWith("S_")) {
        Toast.show({ type: "error", text1: "OTP issue" });
        return;
      }

      if (code?.startsWith("E_")) {
        Toast.show({ type: "error", text1: "OTP expired / invalid" });
        return;
      }

      Toast.show({ type: "error", text1: "Unexpected response" });
    } catch {
      Toast.show({ type: "error", text1: "Confirmation failed" });
    } finally {
      setLoading(false);
    }
  };

  // ================= OTP VISIBILITY LOGIC =================
  const showOtp =
    selectedMethod === "bank" ||
    (selectedMethod === "cheque" && selectedSlot);

  const isValid =
    otp &&
    selectedMethod &&
    (selectedMethod !== "cheque" || (appointmentDate && selectedSlot));

  // ================= UI =================
  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        <View style={styles.container}>
          <TouchableOpacity
            style={styles.topBackButton}
            onPress={() => router.replace("/(tabs)")}
          >
            <Text style={styles.topBackText}>← Back</Text>
          </TouchableOpacity>

          <View style={styles.headerContainer}>
            <Ionicons name="document-text-outline" size={70} color="#ff5a5f" />
            <Text style={styles.mainLabel}>Loan Confirmation</Text>
            <Text style={styles.subLabel}>
              Select method and complete transaction
            </Text>
          </View>

          <View style={styles.form}>
            {/* METHODS */}
            <Text style={styles.label}>Disbursement Method</Text>

            {proceedsOptions.some(o => o.includes("bank")) && (
              <TouchableOpacity
                style={[
                  styles.optionCard,
                  selectedMethod === "bank" && styles.optionCardActive,
                ]}
                onPress={() => {
                  setSelectedMethod("bank");
                  setTimeSlots([]);
                  setSelectedSlot(null);
                }}
              >
                <MaterialIcons
                  name="account-balance"
                  size={24}
                  color={selectedMethod === "bank" ? "#fff" : "#ff5a5f"}
                />
                <Text
                  style={[
                    styles.optionText,
                    { color: selectedMethod === "bank" ? "#fff" : "#ff5a5f" },
                  ]}
                >
                  Bank Crediting
                </Text>
              </TouchableOpacity>
            )}

            {proceedsOptions.some(o => o.includes("cheque")) && (
              <TouchableOpacity
                style={[
                  styles.optionCard,
                  selectedMethod === "cheque" && styles.optionCardActive,
                ]}
                onPress={() => setSelectedMethod("cheque")}
              >
                <MaterialIcons
                  name="receipt-long"
                  size={24}
                  color={selectedMethod === "cheque" ? "#fff" : "#ff5a5f"}
                />
                <Text
                  style={[
                    styles.optionText,
                    { color: selectedMethod === "cheque" ? "#fff" : "#ff5a5f" },
                  ]}
                >
                  Cheque
                </Text>
              </TouchableOpacity>
            )}

            {/* CHEQUE FLOW */}
            {selectedMethod === "cheque" && (
              <>
                <Text style={[styles.label, { marginTop: 20 }]}>
                  Appointment Date
                </Text>

                <TouchableOpacity
                  onPress={() => setShowPicker(true)}
                  style={styles.inputWrapper}
                >
                  <MaterialIcons name="calendar-today" size={20} color="#ff5a5f" />
                  <Text>{appointmentDate.toISOString().split("T")[0]}</Text>
                </TouchableOpacity>

                {showPicker && (
                  <DateTimePicker
                    value={appointmentDate}
                    mode="date"
                    minimumDate={new Date()}
                    onChange={async (event, date) => {
                      setShowPicker(false);
                      if (date) {
                        setAppointmentDate(date);
                        await validateAppointment(date);
                      }
                    }}
                  />
                )}

                {timeSlots.length > 0 && (
                  <>
                    <Text style={[styles.label, { marginTop: 20 }]}>
                      Time Slots
                    </Text>
                    <View style={styles.pickerWrapper}>
                      <Picker
                        selectedValue={selectedSlot?.Code}
                        onValueChange={(value) => {
                          const slot = timeSlots.find((s) => s.Code === value);
                          setSelectedSlot(slot || null);
                        }}
                      >
                        <Picker.Item label="Select a time slot" value={null} />
                        {timeSlots.map((slot) => (
                          <Picker.Item
                            key={slot.Code}
                            label={slot.TimeSchedule}
                            value={slot.Code}
                          />
                        ))}
                      </Picker>
                    </View>
                  </>
                )}
                  </>
                )}

            {/* OTP (BOTTOM) */}
            {showOtp && (
              <View style={{ marginTop: 30 }}>
                <Text style={styles.label}>OTP</Text>

                <View style={styles.inputWrapper}>
                  <MaterialIcons name="sms" size={20} color="#ff5a5f" />
                  <TextInput
                    placeholder="Enter OTP"
                    style={styles.input}
                    value={otp}
                    onChangeText={setOtp}
                    keyboardType="number-pad"
                  />
                </View>

                <TouchableOpacity onPress={sendOtp} style={styles.sendOtpButton}>
                  <Text style={styles.sendOtpText}>Send OTP</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* CONFIRM */}
          <TouchableOpacity
            style={[
              styles.confirmButton,
              (!isValid || loading) && { opacity: 0.5 },
            ]}
            onPress={() => setShowTermsModal(true)}
            disabled={!isValid || loading}
          >
            <Text style={styles.confirmButtonText}>
              {loading ? "Processing..." : "Confirm Loan"}
            </Text>
          </TouchableOpacity>
        </View>
        {showTermsModal && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>

            <Text style={styles.modalTitle}>Terms & Conditions</Text>

            {/* 3 CHECKBOXES */}
            <Text style={styles.modalDesc}>
              By checking the items below, you are declaring that you have received through your e-mail and examined carefully the following documents:
            </Text>

            {/* CHECKBOX 1 */}
            <TouchableOpacity
              style={styles.checkboxRow}
              onPress={() => {
                const updated = [...terms];
                updated[0] = !updated[0];
                setTerms(updated);
              }}
            >
              <View style={[styles.checkbox, terms[0] && styles.checkboxActive]} />
              <View style={{ flex: 1 }}>
              <Text style={styles.checkboxLabel}>
                Amortization Schedule, Authority to Deduct, Promissory Note, and Disclosure Statement on Loan/Credit Transaction
              </Text>
              </View>
            </TouchableOpacity>

            <Text style={styles.helperText}>Tick the box if files received</Text>

            {/* CHECKBOX 2 */}
            <TouchableOpacity
              style={styles.checkboxRow}
              onPress={() => {
                const updated = [...terms];
                updated[1] = !updated[1];
                setTerms(updated);
              }}
            >
              <View style={[styles.checkbox, terms[1] && styles.checkboxActive]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.checkboxLabel}>
                  I understand that checking this box constitutes an electronic signature confirming and approving that I agree and accept the terms and conditions as stated. Further, this constitutes my consent to electronically sign the loan application, ATD, PN, and DS. The copies of electronically and digitally signed documents will be submitted in to my e-mail address upon completion of loan confirmation.
                </Text>
              </View>
            </TouchableOpacity>

            <Text style={styles.helperText}>Tick the box if you agree</Text>

            {/* CHECKBOX 3 */}
            <TouchableOpacity
              style={styles.checkboxRow}
              onPress={() => {
                const updated = [...terms];
                updated[2] = !updated[2];
                setTerms(updated);
              }}
            >
              <View style={[styles.checkbox, terms[2] && styles.checkboxActive]} />
              <View style={{ flex: 1 }}>
              <Text style={styles.checkboxLabel}>
                I hereby agree to be governed by the Terms and Conditions of the Manila Teachers' Online Loan Management System agreement and certify that the above supplied information are true and correct. I hereby also acknowledge to have read and fully understood the said Terms and Conditions.
              </Text></View>
            </TouchableOpacity>

            <Text style={styles.helperText}>Tick the box if you agree</Text>

            {/* BUTTONS */}
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancel}
                onPress={() => {
                  setShowTermsModal(false);
                  setTerms([false, false, false]); // 👈 reset
                }}
              >
                <Text style={{ color: "#fff" }}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalConfirm}
                onPress={() => {
                  const allChecked = terms.every(Boolean);

                  if (!allChecked) {
                    Toast.show({
                      type: "error",
                      text1: "Please accept all terms",
                    });
                    return;
                  }

                  setShowTermsModal(false);
                  handleConfirm();
                }}
              >
                <Text style={{ color: "#fff", fontWeight: "600" }}>
                  Confirm
                </Text>
              </TouchableOpacity>
            </View>

          </View>
        </View>
      )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ================= STYLES =================
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    padding: 25,
  },
  headerContainer: {
    alignItems: "center",
    marginTop: 60,
    marginBottom: 40,
  },
  mainLabel: {
    fontSize: 24,
    fontWeight: "bold",
    marginTop: 10,
  },
  subLabel: {
    fontSize: 14,
    color: "#777",
    textAlign: "center",
  },
  form: {
    marginVertical: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 5,
    color: "#555",
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 2,
    borderBottomColor: "#ff5a5f",
    marginBottom: 15,
  },
  input: {
    flex: 1,
    paddingVertical: 10,
  },
  optionCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 15,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#ff5a5f",
    marginBottom: 12,
  },
  optionCardActive: {
    backgroundColor: "#ff5a5f",
  },
  optionText: {
    marginLeft: 12,
    fontSize: 16,
    fontWeight: "600",
    color: "#ff5a5f",
  },
  sendOtpButton: {
    alignSelf: "flex-start",
  },
  sendOtpText: {
    color: "#ff5a5f",
    fontWeight: "600",
  },
  confirmButton: {
    backgroundColor: "#ff5a5f",
    padding: 15,
    borderRadius: 25,
    alignItems: "center",
  },
  confirmButtonText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 16,
  },
  topBackButton: {
    marginTop: 10,
  },
  topBackText: {
    color: "#ff5a5f",
    fontWeight: "bold",
    fontSize: 16,
  },
  pickerWrapper: {
    borderWidth: 1,
    borderColor: "#ff5a5f",
    borderRadius: 10,
    marginBottom: 0,
  },
  modalOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalBox: {
    width: "85%",
    backgroundColor: "#fff",
    borderRadius: 15,
    padding: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 15,
    textAlign: "center",
  },
  checkboxRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 12,
    width: "100%", 
  },
  checkbox: {
    width: 20,
    height: 20,
    borderWidth: 2,
    borderColor: "#ff5a5f",
    marginRight: 10,
    borderRadius: 4,
    marginTop: 3, 
  },
  checkboxActive: {
    backgroundColor: "#ff5a5f",
  },
  checkboxLabel: {
    fontSize: 13,
    color: "#333",
    textAlign: "justify",
    flexShrink: 1,
  },
  modalButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 20,
  },
  modalCancel: {
    flex: 1,
    backgroundColor: "#aaa",
    padding: 10,
    borderRadius: 10,
    marginRight: 5,
    alignItems: "center",
  },
  modalConfirm: {
    flex: 1,
    backgroundColor: "#ff5a5f",
    padding: 10,
    borderRadius: 10,
    marginLeft: 5,
    alignItems: "center",
  },
  modalDesc: {
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 10,
    color: "#000",
    textAlign: "justify",
  },
  helperText: {
    fontSize: 10,
    color: "#b94a48",
    marginBottom: 8,
    textAlign: "justify",
  },
});