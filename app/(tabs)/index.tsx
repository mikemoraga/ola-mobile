import { getData } from "@/utils/storage";
import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect } from "@react-navigation/native";
import axios from "axios";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Row, Table } from "react-native-table-component";
import Toast from "react-native-toast-message";

export default function HomeScreen() {
  const router = useRouter();
  const { refresh } = useLocalSearchParams(); // now works

  const [currentPage, setCurrentPage] = useState(1);
  const [userName, setUserName] = useState("");
  const [tableData, setTableData] = useState<string[][]>([]);
  const [loading, setLoading] = useState(true);
  const rowsPerPage = 5;

  const fetchUserAndLoans = async () => {
    const storedUser = await getData("user");
    console.log("Stored user:", storedUser);

    if (!storedUser?.token || !storedUser?.username) {
      setLoading(false);
      router.replace("/login");
      return;
    }

    if (storedUser?.firstname) setUserName(storedUser.firstname);
    else setUserName("Unknown");

    try {
      const response = await axios.post(
        `${API_URL}api/OLMS/Loan/View`,
        {
          USERNAME: storedUser.username,
          DEVICEID: "1",
        },
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${storedUser.token}`,
          },
        }
      );

      const data = response.data;
      console.log("RAW Loan/View response:", data);

      if (Array.isArray(data)) {
        const formatted = data.map((item) => [
          item.REFID_LOAN,
          item.TRANDATE?.split("T")[0],
          `₱${item.LOAN_AMOUNT.toLocaleString("en-PH")}`,
          item.LOAN_STATUS,
        ]);

        setTableData(formatted);
        console.log("Formatted loan table data:", formatted);
      } else {
        console.warn("Unexpected API response:", data);
      }
    } catch (error: any) {
      if (axios.isAxiosError(error) && error.response?.status === 401) {
        Toast.show({
          type: "error",
          text1: "Session expired",
          text2: "Please log in again",
        });
      router.replace("/login"); // replace > push to avoid going back
      return;
    }
    else {
            console.error("Error fetching loan data:", error);
          }
        } finally {
          setLoading(false);
        }
      };

    useEffect(() => {
      fetchUserAndLoans();
    }, [refresh]); // now it will refetch when refresh param changes

    // View Detector & Table Refresher
    useFocusEffect(
      useCallback(() => {
        console.log("Loan Table Refreshed");
        fetchUserAndLoans(); // reloads the table
      }, [])
    );

  const totalPages = Math.ceil(tableData.length / rowsPerPage);
  const handleNext = () => currentPage < totalPages && setCurrentPage(currentPage + 1);
  const handlePrev = () => currentPage > 1 && setCurrentPage(currentPage - 1);
  const currentData = tableData.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);

  const numLoans = tableData.length;
  const totalAmount = tableData.reduce((sum, row) => {
    const amount = parseInt((row?.[2] || "₱0").replace("₱", "").replace(/,/g, "")) || 0;
    return sum + amount;
  }, 0);

  const pendingLoans = tableData.filter((row) => row[3] === "Submitted").length;
  const tableHead = ["Reference ID", "Transaction Date", "Loan Amount", "Loan Status"];

  //-- FOR APPLY FOR LOAN VALIDATION --

  const handleApplyForLoan = async () => {
    const storedUser = await getData("user");

    if (!storedUser?.token || !storedUser?.username) {
      router.replace("/login");
      return;
    }

    try {
      const response = await axios.post(
        `${API_URL}api/OLMS/Loan/Validation`,
        {
          USERNAME: storedUser.username,
          DEVICEID: "1",
        },
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${storedUser.token}`,
          },
        }
      );

      const data = response.data;
      console.log("Validation response:", data);
      
      // DataTable serializes as an array of row objects
      const result = Array.isArray(data) ? data[0] : data;

      const responseCode: string = result?.RESPONSE_CODE ?? "";
      const allowUpload: string = result?.ALLOW_UPLOAD ?? "N";

      // If API returns an error/message flag, block navigation
      if (responseCode === "L_1") {
        Toast.show({
          type: "error",
          text1: "Cannot Apply",
          text2: result?.RESPONSE_MESSAGE || "Unable to proceed with transaction. Loan application is temporarily disabled on your designated branch.",
        });
        return;
      }
      else if (responseCode === "L_2") {
        Toast.show({
          type: "error",
          text1: "Cannot Apply",
          text2: result?.RESPONSE_MESSAGE || "You still have a loan with {STATUS} loan status",
        });
        return;
      }
      else if (responseCode === "L_5") {
        Toast.show({
          type: "error",
          text1: "Cannot Apply",
          text2: result?.RESPONSE_MESSAGE || "Loan has an active loan.",
        });
        return;
      }
      else if (responseCode === "L_6") {
        Toast.show({
          type: "error",
          text1: "Cannot Apply",
          text2: result?.RESPONSE_MESSAGE || "Loan has an active loan.",
        });
        return;
      }
      else if (responseCode === "L_14") {
        Toast.show({
          type: "error",
          text1: "Cannot Apply",
          text2: result?.RESPONSE_MESSAGE || "Loan has an active loan.",
        });
        return;
      }
      else if (result?.RESPONSE_CODE !== "L_0" || result?.status === "error") {
        Toast.show({
          type: "error",
          text1: "Cannot Apply",
          text2: result?.RESPONSE_MESSAGE || "You are not eligible to apply for a loan.",
        });
        return;
      }

      // Validation passed — proceed to apply
      router.push("/applyforloan");

    } catch (error: any) {
      if (axios.isAxiosError(error)) {
        const message =
          error.response?.data?.message ||
          error.response?.data?.Message ||
          "Validation failed. Please try again.";

        Toast.show({
          type: "error",
          text1: "Cannot Apply",
          text2: message,
        });

        if (error.response?.status === 401) {
          router.replace("/login");
        }
      } else {
        console.error("Unexpected validation error:", error);
      }
    }
  };

  const getLoanBlockMessage = (code: string): string => {
    const messages: Record<string, string> = {
      "L_0": "You are not eligible to apply for a loan.",
      "L_2": "You already have an active loan.",
      "L_5": "Loan processing has been disabled for a specific amount of time.()",
      "L_3": "Your account is not yet verified.",
    };
    return messages[code] ?? `Application not allowed. (${code})`;
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.cardHeader}>
        <View style={styles.avatarContainer}>
          <Ionicons name="person" size={50} color="#fff" />
        </View>

        <Text style={styles.userName}>{userName}</Text>
        <Text style={styles.cardTitle}>Manage Loans</Text>
        <Text style={styles.cardSubtitle}>
          View and manage all your loan applications
        </Text>

        {/* Stats */}
        <View style={styles.statsCard}>
          <View style={styles.statsColumn}>
            <Text style={styles.statsValue}>{numLoans}</Text>
            <Text style={styles.statsLabel}>Loans</Text>
          </View>
          <View style={styles.statsColumn}>
            <Text style={styles.statsValue}>₱{totalAmount.toLocaleString("en-PH")}</Text>
            <Text style={styles.statsLabel}>Total Amount</Text>
          </View>
          <View style={styles.statsColumn}>
            <Text style={styles.statsValue}>{pendingLoans}</Text>
            <Text style={styles.statsLabel}>Pending</Text>
          </View>
        </View>
      </View>

      {/* Table */}
      <View style={styles.tableCard}>
        <Table>
          {/* Always show headers */}
          <Row data={tableHead} style={styles.tableHead} textStyle={styles.tableHeadText} />
          
          {loading ? (
            <View style={{ padding: 30, alignItems: "center" }}>
              <ActivityIndicator size="large" color="#ff5a5f" />
              <Text style={{ marginTop: 10 }}>Loading loans...</Text>
            </View>
          ) : (
            currentData.map((rowData, index) => {
              const refid = rowData[0];
              return (
                <TouchableOpacity
                  key={index}
                  onPress={() =>
                    router.push({
                      pathname: "/loandetails/[refid]",
                      params: { refid },
                    })
                  }
                  activeOpacity={0.7}
                >
                  <Row
                    data={rowData}
                    style={{
                      height: 40,
                      backgroundColor: index % 2 === 0 ? "#f5f5f5" : "#e0e0e0",
                      borderBottomWidth: 1,
                      borderBottomColor: "rgba(0,0,0,0.1)",
                    }}
                    textStyle={styles.tableText}
                  />
                </TouchableOpacity>
              );
            })
          )}
        </Table>
      </View>

      {/* Pagination */}
      <View style={styles.paginationContainer}>
        <TouchableOpacity
          style={[styles.paginationButton, currentPage === 1 && styles.disabledButton]}
          onPress={handlePrev}
          disabled={currentPage === 1}
        >
          <Text style={styles.paginationButtonText}>Prev</Text>
        </TouchableOpacity>
        <Text style={styles.pageIndicator}>
          Page {currentPage} of {totalPages || 1}
        </Text>
        <TouchableOpacity
          style={[styles.paginationButton, currentPage === totalPages && styles.disabledButton]}
          onPress={handleNext}
          disabled={currentPage === totalPages}
        >
          <Text style={styles.paginationButtonText}>Next</Text>
        </TouchableOpacity>
      </View>

      {/* Apply Button */}
      <TouchableOpacity
        style={styles.applyButton}
        // onPress={() => router.push("/applyforloan")}
        
        onPress={handleApplyForLoan}
      >
        <Text style={styles.applyButtonText}>Apply for Loan</Text>
      </TouchableOpacity>
    </View>
  );
  
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: "#f2f2f2", 
    padding: 15 
  },
  cardHeader: {
    backgroundColor: "#fff",
    padding: 15,
    borderRadius: 12,
    marginBottom: 30,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    alignItems: "center",
    position: "relative",
    marginTop: 20,
  },
  avatarContainer: {
    width: 80,
    height: 80,
    borderRadius: 100,
    backgroundColor: '#ff5a5f',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  avatar: {
  // ahhahaha
  },
  userName: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
    textTransform: "capitalize",
    letterSpacing: 3,
    marginBottom: 6,
    fontFamily: "Comic Sans MS",
    textShadowColor: "rgba(0, 0, 0, 0.2)",
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 3,
    borderBottomWidth: 2,
    borderBottomColor: "#ff5a5f",
    paddingBottom: 4,
  },
  cardTitle: { 
    fontSize: 24, 
    fontWeight: "bold", 
    color: "#ff5a5f" 
  },
  cardSubtitle: {
    fontSize: 14,
    color: "#333",
    marginTop: 4,
    marginBottom: 50,
    textAlign: "center",
  },
  statsCard: {
    flexDirection: "row",
    justifyContent: "space-around",
    backgroundColor: "#fff",
    paddingVertical: 15,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#ddd",
    position: "absolute",
    bottom: -30,
    left: 15,
    right: 15,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    zIndex: 10,
  },
  statsColumn: { 
    alignItems: "center" 
  },
  statsValue: { 
    fontSize: 20, 
    fontWeight: "bold", 
    color: "#ff5a5f" 
  },
  statsLabel: { 
    fontSize: 12, 
    color: "#333" 
  },
  tableCard: {
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#ddd",
    marginBottom: 10,
    marginTop: 20,
  },
  tableHead: {
    height: 40,
    backgroundColor: "transparent",
    borderBottomWidth: 1,
    borderColor: "#ff5a5f",
  },
  tableHeadText: {
    textAlign: "center",
    fontSize: 14,
    fontWeight: "bold",
    color: "#000",
  },
  tableText: { 
    textAlign: "center", 
    fontSize: 14 
  },
  paginationContainer: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    marginBottom: 20,
  },
  paginationButton: {
    borderColor: "#ff5a5f",
    borderWidth: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 25,
    marginLeft: 5,
  },
  paginationButtonText: { 
    color: "#ff5a5f", 
    fontWeight: "bold", 
    fontSize: 14 
  },
  disabledButton: { 
    opacity: 0.5 
  },
  pageIndicator: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#333",
    marginHorizontal: 10,
  },
  applyButton: {
    position: "absolute",
    bottom: 50,
    left: 15,
    right: 15,
    backgroundColor: "#ff5a5f",
    padding: 15,
    borderRadius: 25,
    alignItems: "center",
    justifyContent: "center",
  },
  applyButtonText: { 
    color: "#fff", 
    fontWeight: "bold", 
    fontSize: 16 
  },
});
