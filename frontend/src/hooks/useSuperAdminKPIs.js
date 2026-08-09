import { useEffect, useState } from "react";
import {
  collection,
  query,
  where,
  Timestamp,
  getCountFromServer // 🟢 Production upgrade! Saves 99% on read costs
} from "firebase/firestore";
import { db } from "../firebaseClient";

export function useSuperAdminKPIs() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [kpis, setKpis] = useState({
    totalOrganisations: 0,
    totalMachines: 0,
    totalAdmins: 0,
    totalRefillers: 0,
    totalRefills: 0,
    refillsLast7Days: 0,
  });

  useEffect(() => {
    loadKPIs();
  }, []);

  async function loadKPIs() {
    setLoading(true);
    setError(null);

    try {
      const sevenDaysAgo = Timestamp.fromDate(
        new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      );

      // 🟢 GET COUNT FROM SERVER (Costs 1 read per metric, instead of 1 read per document!)
      const [
        orgCount,
        machineCount,
        adminCount,
        refillerCount,
        refillCount,
        recentRefillCount,
      ] = await Promise.all([
        getCountFromServer(collection(db, "organisations")),
        getCountFromServer(collection(db, "machines")),
        getCountFromServer(query(collection(db, "users"), where("role", "==", "admin"))),
        getCountFromServer(query(collection(db, "users"), where("role", "==", "refiller"))),
        getCountFromServer(collection(db, "refill_logs")),
        getCountFromServer(query(collection(db, "refill_logs"), where("createdAt", ">=", sevenDaysAgo))),
      ]);

      setKpis({
        totalOrganisations: orgCount.data().count,
        totalMachines: machineCount.data().count,
        totalAdmins: adminCount.data().count,
        totalRefillers: refillerCount.data().count,
        totalRefills: refillCount.data().count,
        refillsLast7Days: recentRefillCount.data().count,
      });
    } catch (err) {
      console.error("❌ KPI load failed", err);
      setError(err);
    } finally {
      setLoading(false);
    }
  }

  return { 
    kpis, 
    stats: {
        organisations: kpis.totalOrganisations,
        machines: kpis.totalMachines,
        admins: kpis.totalAdmins,
        refills: kpis.totalRefills
    },
    loading, 
    error, 
    reloadKPIs: loadKPIs 
  };
}