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

import AddProductModal from "../../components/AdminProducts/AddProductModal";
import EditProductModal from "../../components/AdminProducts/EditProductModal";

export default function AdminProducts() {
  const { user, orgId } = useAdmin(); // 🟢 Use Secure Context
  const [products, setProducts] = useState([]);

  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [showAdd, setShowAdd] = useState(false);
  const [editProduct, setEditProduct] = useState(null);

  useEffect(() => {
    if (!orgId) return;

    // 🟢 SECURE LIVE QUERY: Only fetch products for THIS Org
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
      return skuA.localeCompare(skuB, undefined, { numeric: true });
    });

  }, [products, search]);

  const paged = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, currentPage, pageSize]);

  async function deleteProduct(id) {
    if (!confirm("Delete this product? It will be removed from all slot configurations as well.")) return;

    try {
      await deleteDoc(doc(db, "products", id));

      await addDoc(collection(db, "admin_actions"), {
        actorEmail: user?.email || "unknown",
        actionType: "delete_product",
        productId: id,
        orgId: orgId, // 🟢 Audit trail isolation
        createdAt: serverTimestamp()
      });

      alert("Product deleted.");
    } catch (err) {
      console.error(err);
      alert("Delete failed.");
    }
  }

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <h1>Manage Products (Catalog)</h1>

        <button style={btnGreen} onClick={() => setShowAdd(true)}>
          + Add Product
        </button>
      </div>

      <ProductFilterBar search={search} setSearch={setSearch} />

      <div style={{ background: "#fff", borderRadius: 12, overflow: "hidden", border: "1px solid #e2e8f0" }}>
        <ProductTable products={paged} onEdit={setEditProduct} onDelete={deleteProduct} />
        
        {products.length === 0 && (
            <div style={{ padding: 40, textAlign: "center", color: "#64748b" }}>
                Your catalog is empty. Add a product to get started.
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

      {/* 🟢 Ensure Add/Edit Modals know about orgId so they save data correctly */}
      {showAdd && <AddProductModal onClose={() => setShowAdd(false)} orgId={orgId} user={user} />}
      {editProduct && (
        <EditProductModal product={editProduct} onClose={() => setEditProduct(null)} user={user} />
      )}
    </div>
  );
}

const btnGreen = { padding: "10px 16px", background: "#10b981", border: "none", borderRadius: 8, color: "#fff", cursor: "pointer", fontWeight: "bold" };