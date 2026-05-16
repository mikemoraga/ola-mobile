"use client";
import CustomModalConfig from "@/app/customconfirmation";
import { getData } from "@/utils/storage";
import axios from "axios";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Row, Table } from "react-native-table-component";
import Toast from "react-native-toast-message";

export default function LoanDetailsPage() {
  const router = useRouter();
  const { refid, refresh } = useLocalSearchParams();
  const [loading, setLoading] = useState(true);
  const [loan, setLoan] = useState<any | null>(null);
  const [showModal, setShowModal] = useState(false);

  const statusToStep = (status: string | undefined) => {
    if (!status) return 1;
    const s = status.toLowerCase();

    if (s.includes("calculation")) return 1;
    if (s.includes("payslip")) return 2;
    if (s.includes("submitted")) return 3;
    if (s.includes("approval") || s.includes("approved")) return 4;
    if (s.includes("confirmation") || s.includes("confirmed")) return 5;
    if (s.includes("release") || s.includes("released")) return 6;

    return 1;
  };

  const step = statusToStep(loan?.LOAN_STATUS);
  const progress = Math.max(0, Math.min(1, (step - 1) / 4));

  useEffect(() => {
    const fetchDetails = async () => {
      setLoading(true);
      const storedUser = await getData("user");
      if (!storedUser?.token || !storedUser?.username) {
        setLoading(false);
        return;
      }

      try {
        const body = {
          USERNAME: storedUser.username,
          REFID_LOAN: refid,
          DEVICEID: "1",
        };
        const res = await axios.post(`${API_URL}api/OLMS/Loan/Details`, body, {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${storedUser.token}`,
          },
        });

       const data = res.data;
        console.log("Loan details response:", res);
        console.log("Loan details response data:", data);

        if (Array.isArray(data) && data.length > 0) {
        if (data[0].RESPONSE_CODE === "L_12") {
            // all columns show "Cancelled"
            setLoan({
            REFID_LOAN: "",
            TRANDATE: "",
            STEP_DESC: "",
            REQ_AMOUNT: "",
            TERMS: "",
            APPROVED: "",
            MONTHLY_AMORT: "",
            LOAN_STATUS: "",
            REMARKS: "Cancelled",
            });
        } else {
            const latest = data[data.length - 1];
            setLoan(latest);
        }
        }}
      catch (err) {
              console.error("Loan details fetch error:", err);
            } finally {
              setLoading(false);
            }
          };
          if (refid) fetchDetails();
          else setLoading(false);
        }, [refid, refresh]);

  const tableHead = ["Field", "Value"];
  const tableData = loan
    ? Object.entries({
        "Reference ID": loan.REFID_LOAN,
        "Transaction Date": new Date(loan.TRANDATE).toLocaleString("en-PH"),
        "Step Description": loan.STEP_DESC?.replace(/\r\n/g, " "),
        "Requested Amount": Number(loan.REQ_AMOUNT).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
        "Loan Terms": loan.TERMS,
        "Approved Amount": Number(loan.APPROVED).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
        "Monthly Amortization": Number(loan.MONTHLY_AMORT).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
        "Loan Status": loan.LOAN_STATUS,
        "Remarks": loan.REMARKS,
      }).map(([label, value]) => [label, value])
    : [];

  const cancelled = loan?.REMARKS === "Cancelled" || loan?.LOAN_STATUS?.toLowerCase() === "released" || loan?.LOAN_STATUS?.toLowerCase() === "confirmed";

  const disabledConfirm = loan?.REMARKS === "Cancelled" || loan?.LOAN_STATUS?.toLowerCase() === "confirmed" || loan?.LOAN_STATUS?.toLowerCase() === "released" || loan?.LOAN_STATUS?.toLowerCase() === "submitted";

  const handleCancel = () => {
    setShowModal(true);
  };

  const proceedCancel = async () => {
    const storedUser = await getData("user");
    if (!storedUser?.token || !storedUser?.username) {
      Toast.show({ type: "error", text1: "User not found" });
      return;
    }

    try {
      const body = {
        STAT: "CAN",
        USERNAME: storedUser.username,
        IPADDRESS: "",
        REFID_LOAN: refid,
        DEVICEID: "::1",
      };

      await axios.post(`${API_URL}api/OLMS/Loan/Update`, body, {
        headers: { Authorization: `Bearer ${storedUser.token}` },
      });

      Toast.show({ type: "success", text1: "Loan cancelled successfully" });
      router.push({
        pathname: "/(tabs)",
        params: { refresh: Date.now() },
      });
    } catch (err) {
      console.error("Cancel loan error:", err);
      Toast.show({ type: "error", text1: "Failed to cancel loan" });
    }
    
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {/* Back / Cancel / Confirm Buttons */}
      <View style={styles.topButtonRow}>
        <TouchableOpacity
          style={styles.topButton}
          onPress={() => router.back()}
        >
          <Text style={styles.topButtonText}>← Back</Text>
        </TouchableOpacity>

        <View style={{ flexDirection: "row", gap: 10 }}>
          <TouchableOpacity
              style={[
                styles.topButton,
                {
                  backgroundColor: cancelled ? "#999" : "#999",
                  opacity: cancelled ? 0.4 : 1,
                },
              ]}
              onPress={handleCancel}
              disabled={cancelled}
            >
              <Text style={styles.topButtonText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.topButton,
                { opacity: disabledConfirm ? 0.4 : 1 }
              ]}
              onPress={() =>
                router.push({
                  pathname: "/loanconfirmation",
                  params: {
                    refid: loan?.REFID_LOAN,
                  },
                })
              }
              disabled={disabledConfirm}
            >
              <Text style={styles.topButtonText}>Confirm</Text>
            </TouchableOpacity>
          </View>
        </View>

      {/* Header */}
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>Loan Application Details</Text>
        <Text style={styles.cardSubtitle}>
          Detailed information about your loan application. Progress is shown below.
        </Text>
      </View>

      {/* Table */}
      {loading ? (
        <ActivityIndicator size="large" color="#ff5a5f" style={{ marginTop: 50 }} />
      ) : loan ? (
        
        <View style={styles.formCard}>
          <Table>
            <Row
              data={tableHead}
              style={styles.tableHead}
              textStyle={[styles.tableHeadText, { flexWrap: "wrap" }]}
            />
            {tableData.map(([label, value], index) => (
                <Row
                    key={index}
                    data={[
                    <Text style={{ textAlign: "center" }}>{label}</Text>,
                    <Text
                        style={{
                        textAlign: "center",
                        flexWrap: "wrap",
                        color: label === "Remarks" && value === "Cancelled" ? "#ff5a5f" : "#000",
                        }}
                        adjustsFontSizeToFit
                        numberOfLines={3}
                        minimumFontScale={0.7}
                    >
                        {value}
                    </Text>,
                    ]}
                    style={{
                    minHeight: 30,
                    backgroundColor: index % 2 === 0 ? "#f5f5f5" : "#e0e0e0",
                    borderBottomWidth: 1,
                    borderBottomColor: "rgba(0,0,0,0.1)",
                    paddingHorizontal: 5,
                    paddingVertical: 2,
                    }}
                />
                ))}
          </Table>
        </View>
      ) : (
        <View style={{ padding: 20 }}>
          <Text>No loan details found.</Text>
        </View>
      )}

      {/* Progress bar */}
      <View style={styles.progressCard}>
        <Text style={styles.progressText}>
          Completed {step === 3 ? 2 : step - 1} steps out of 5
        </Text>
        <View style={styles.progressContainer}>
          <View style={styles.progressBackground}>
            <View style={[styles.progressFill, { width: cancelled ? "100%" : `${progress * 100}%`, backgroundColor: cancelled ? "#ff5a5f" : "#ff9800" }]} />
          </View>
          <View style={styles.progressLabels}>
            <Text style={[styles.progressLabel, { color: step >= 2 ? "#4caf50" : "#ff9800" }]}>
              Calculation
            </Text>
            <Text style={[styles.progressLabel, { color: step >= 3 ? "#4caf50" : step === 2 ? "#ff9800" : "#bbb" }]}>
              Payslip
            </Text>
            <Text style={[styles.progressLabel, { color: step === 3 ? "#ff9800" : step > 3 ? "#4caf50" : "#bbb" }]}>
              Approval
            </Text>
            <Text style={[styles.progressLabel, { color: step === 4 ? "#ff9800" : step > 4 ? "#4caf50" : "#bbb" }]}>
              Confirmation
            </Text>
            <Text style={[styles.progressLabel, { color: step === 5 ? "#ff9800" : step > 5 ? "#4caf50" : "#bbb" }]}>
              Release
            </Text>
          </View>
        </View>
        <View style={styles.legendRow}>
          <Text style={[styles.legend, { color: "#4caf50" }]}>● Completed</Text>
          <Text style={[styles.legend, { color: "#ff9800" }]}>● In-Progress</Text>
          <Text style={[styles.legend, { color: "#bbb" }]}>● Not Started</Text>
        </View>
      </View>

      {/* Custom confirmation modal */}
      {showModal && CustomModalConfig.default({
        title: "Confirm Cancel",
        message: "Are you sure you want to cancel this loan?",
        onCancel: () => setShowModal(false),
        onConfirm: async () => {
          setShowModal(false);
          await proceedCancel();
        },
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { 
    backgroundColor: "#f2f2f2", 
    flexGrow: 1, 
    paddingBottom: 50 
  },
  topButtonRow: { 
    flexDirection: "row", 
    justifyContent: "space-between", 
    marginHorizontal: 15, 
    marginTop: 30 
  },
  topButton: { 
    backgroundColor: "#ff5a5f", 
    paddingVertical: 10, 
    paddingHorizontal: 20, 
    borderRadius: 25 
  },
  topButtonText: { 
    color: "#fff", 
    fontWeight: "bold", 
    fontSize: 14 
  },
  cardHeader: {
    margin: 15,
    backgroundColor: "#fff",
    padding: 20,
    marginTop: 15,
    borderRadius: 12,
    marginBottom: 15,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardTitle: { 
    fontSize: 24, 
    fontWeight: "bold", 
    color: "#333", 
    textAlign: "center", 
    marginBottom: 10 
  },
  cardSubtitle: { 
    fontSize: 14, 
    color: "#333", 
    textAlign: "justify" 
  },
  formCard: { 
    backgroundColor: "#fff", 
    borderRadius: 12, 
    borderWidth: 1, 
    borderColor: "#ddd", 
    padding: 20, 
    marginHorizontal: 15, 
    marginBottom: 5 
  },
  tableHead: { 
    height: 40, 
    backgroundColor: "transparent", 
    borderBottomWidth: 1, 
    borderColor: "#ff5a5f" 
  },
  tableHeadText: { 
    textAlign: "center", 
    fontSize: 14, 
    fontWeight: "bold", 
    color: "#000" 
  },
  tableText: { 
    textAlign: "center", 
    fontSize: 14 
  },
  progressCard: { 
    backgroundColor: "#fff", 
    borderRadius: 12, 
    borderWidth: 1, 
    borderColor: "#ddd", 
    padding: 20, 
    marginHorizontal: 15, 
    marginBottom: 50 
  },
  progressText: { 
    textAlign: "center", 
    fontSize: 14, 
    fontWeight: "500", 
    marginBottom: 10 
  },
  progressContainer: { 
    marginBottom: 5 
  },
  progressBackground: { 
    width: "100%", 
    height: 10, 
    backgroundColor: "#ddd", 
    borderRadius: 5, 
    overflow: "hidden" 
  },
  progressFill: { 
    height: "100%", 
    backgroundColor: "#ff9800" 
  },
  progressLabels: { 
    flexDirection: "row", 
    justifyContent: "space-between", 
    marginTop: 8 
  },
  progressLabel: { 
    fontSize: 10, 
    textAlign: "center", 
    flex: 1 
  },
  legendRow: { 
    flexDirection: "row", 
    justifyContent: "space-around", 
    marginTop: 5 
  },
  legend: { 
    fontSize: 12, 
    fontWeight: "500" 
  },
});
