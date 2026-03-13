// frontend/src/pages/admin/AdminProducts.jsx
import React, { useEffect, useState, useMemo } from "react";
import {
  collection,
  onSnapshot,
  doc,
  addDoc,
  deleteDoc,
  serverTimestamp,
  query,
  where
} from "firebase/firestore";

import { db } from "../../firebaseClient";
import { useAdmin } from "../../contexts/AdminContext"; 

import ProductFilterBar from "../../components/AdminProducts/ProductFilterBar";
import ProductPagination from "../../components/AdminProducts/ProductPagination";
import ProductTable from "../../components/AdminProducts/ProductTable";

export default function AdminProducts() {
  const { user, orgId } = useAdmin(); 
  const [products, setProducts] = useState([]);

  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    if (!orgId) return;

    // 🟢 SECURE LIVE QUERY: Fetch products for THIS Org (Mirrored from Master)
    const q = query(
        collection(db, "products"),
        where("orgId", "==", orgId)
    );

    const unsub = onSnapshot(q, (snap) => {
      setProducts(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, [orgId]);

  useEffect(() => setCurrentPage(1), [search, pageSize]);

  const filtered = useMemo(() => {
    const txt = search.toLowerCase();
    
    // 1. Filter
    const list = products.filter(
      (p) =>
        (p.name || "").toLowerCase().includes(txt) ||
        (p.sku || "").toLowerCase().includes(txt)
    );

    // 2. SORT by SKU Ascending (Numeric aware)
    return list.sort((a, b) => {
      const skuA = (a.sku || "").toString().toLowerCase();
      const skuB = (b.sku || "").toString().toLowerCase();
      return skuA.localeCompare(skuB, undefined, { numeric: true, sensitivity: 'base' });
    });

  }, [products, search]);

  const paged = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, currentPage, pageSize]);

  async function deleteProduct(id) {
    if (!window.confirm("⚠️ Please use the Master Catalog to delete or deactivate products. Do you still want to force delete this from the active list?")) return;

    try {
      await deleteDoc(doc(db, "products", id));
      await addDoc(collection(db, "admin_actions"), {
        actorEmail: user?.email || "unknown",
        actionType: "delete_product_forced",
        productId: id,
        orgId: orgId, 
        createdAt: serverTimestamp()
      });
      alert("Product forced deleted.");
    } catch (err) {
      console.error(err);
      alert("Delete failed.");
    }
  }

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <h1 style={{ margin: 0 }}>Active Warehouse Stock</h1>
          <p style={{ margin: "5px 0 0 0", color: "#64748b", fontSize: 14 }}>
            Only items set to "Active" in the Master Catalog appear here.
          </p>
        </div>
      </div>

      <ProductFilterBar search={search} setSearch={setSearch} />

      <div style={{ background: "#fff", borderRadius: 12, overflow: "hidden", border: "1px solid #e2e8f0" }}>
        {/* We pass a dummy onEdit because edits now happen in Master Catalog */}
        <ProductTable 
            products={paged} 
            onEdit={() => alert("Please go to the 'Master Catalog' to edit product details.")} 
            onDelete={deleteProduct} 
        />
        
        {products.length === 0 && (
            <div style={{ padding: 40, textAlign: "center", color: "#64748b" }}>
                No active products found. Go to Master Catalog to activate items.
            </div>
        )}
      </div>

      <ProductPagination
        total={filtered.length}
        currentPage={currentPage}
        setCurrentPage={setCurrentPage}
        pageSize={pageSize}
        setPageSize={setPageSize}
      />
    </div>
  );
}