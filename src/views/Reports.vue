<script setup>
import { ref, onMounted, onBeforeUnmount, computed } from 'vue';
import { invoke } from '@tauri-apps/api/core';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatAmount, formatNumber, formatPercent } from '../utils/numberFormat';

const currentTab = ref('sales');
const startDate = ref(new Date().toISOString().split('T')[0]);
const endDate = ref(new Date().toISOString().split('T')[0]);
const searchQuery = ref('');

const salesData = ref([]);
const inventoryData = ref([]);
const expensesData = ref([]);
const currencySymbol = ref('Rp');
const loading = ref(false);
const exportNotice = ref({
  visible: false,
  type: 'success',
  title: '',
  lines: []
});
let exportNoticeTimer = null;

// --- Sales Computed ---
const filteredSales = computed(() => {
  if (!searchQuery.value) return salesData.value;
  const q = searchQuery.value.toLowerCase();
  return salesData.value.filter(item =>
    (item.customer || '').toLowerCase().includes(q) ||
    String(item.order_id).includes(q) ||
    item.date.includes(q)
  );
});
const totalExpenses = computed(() => expensesData.value.reduce((sum, exp) => sum + exp.amount, 0));
const totalSales = computed(() => filteredSales.value.reduce((sum, item) => sum + item.total, 0));
const totalProfit = computed(() => filteredSales.value.reduce((sum, item) => sum + item.profit, 0) - totalExpenses.value);
const totalDiscount = computed(() => filteredSales.value.reduce((sum, item) => sum + item.discount, 0));
const totalOrderCount = computed(() => filteredSales.value.length);
const totalItemsSold = computed(() => filteredSales.value.reduce((sum, item) => sum + item.items_count, 0));
const avgOrderValue = computed(() => totalOrderCount.value > 0 ? totalSales.value / totalOrderCount.value : 0);
const profitMargin = computed(() => totalSales.value > 0 ? (totalProfit.value / totalSales.value) * 100 : 0);

// --- Inventory Computed ---
const filteredInventory = computed(() => {
  if (!searchQuery.value) return inventoryData.value;
  const q = searchQuery.value.toLowerCase();
  return inventoryData.value.filter(item =>
    item.name.toLowerCase().includes(q) ||
    (item.category || '').toLowerCase().includes(q)
  );
});
const totalStockValue = computed(() => filteredInventory.value.reduce((sum, item) => sum + item.stock_value, 0));
const totalRetailValue = computed(() => filteredInventory.value.reduce((sum, item) => sum + (item.stock * item.selling_price), 0));
const totalPotentialProfit = computed(() => totalRetailValue.value - totalStockValue.value);
const outOfStockCount = computed(() => filteredInventory.value.filter(item => item.stock <= 0).length);
const lowStockCount = computed(() => filteredInventory.value.filter(item => item.stock > 0 && item.stock <= 5).length);

// --- Date Presets ---
function setDatePreset(preset) {
  const today = new Date();
  endDate.value = today.toISOString().split('T')[0];
  if (preset === 'today') {
    startDate.value = endDate.value;
  } else if (preset === 'week') {
    const d = new Date(today);
    d.setDate(d.getDate() - 6);
    startDate.value = d.toISOString().split('T')[0];
  } else if (preset === 'month') {
    startDate.value = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
  } else if (preset === 'year') {
    startDate.value = new Date(today.getFullYear(), 0, 1).toISOString().split('T')[0];
  } else if (preset === 'all') {
    startDate.value = '2020-01-01';
  }
  loadReport();
}

async function loadReport() {
  loading.value = true;
  try {
    if (currentTab.value === 'sales') {
      const [sales, expenses] = await Promise.all([
        invoke('get_sales_report', { startDate: startDate.value, endDate: endDate.value }),
        invoke('get_expenses', { startDate: startDate.value, endDate: endDate.value })
      ]);
      salesData.value = sales;
      expensesData.value = expenses;
    } else if (currentTab.value === 'inventory') {
      inventoryData.value = await invoke('get_inventory_report');
    }
    const settingsData = await invoke('get_settings');
    if (settingsData && settingsData.currency_symbol) {
      currencySymbol.value = settingsData.currency_symbol;
    }
  } catch (error) {
    console.error("Failed to load report:", error);
  } finally {
    loading.value = false;
  }
}

function closeExportNotice() {
  exportNotice.value.visible = false;
  if (exportNoticeTimer) {
    clearTimeout(exportNoticeTimer);
    exportNoticeTimer = null;
  }
}

function showExportNotice(type, title, lines = []) {
  closeExportNotice();
  exportNotice.value = { visible: true, type, title, lines };
  exportNoticeTimer = setTimeout(() => {
    exportNotice.value.visible = false;
    exportNoticeTimer = null;
  }, 5000);
}

function exportPDF() {
  try {
    const doc = new jsPDF();
    const now = new Date().toLocaleDateString();
    let fileName = '';

    if (currentTab.value === 'sales') {
      doc.setFontSize(16);
      doc.text(`Sales & Profit Report`, 14, 15);
      doc.setFontSize(9);
      doc.text(`Period: ${startDate.value} to ${endDate.value} | Generated: ${now}`, 14, 22);
      doc.text(`Total Sales: ${currencySymbol.value}${formatAmount(totalSales.value)} | Net Profit: ${currencySymbol.value}${formatAmount(totalProfit.value)} | Expenses: ${currencySymbol.value}${formatAmount(totalExpenses.value)} | Orders: ${formatNumber(totalOrderCount.value)}`, 14, 28);

      autoTable(doc, {
        startY: 34,
        head: [['Date', 'Order #', 'Customer', 'Items', 'Discount', 'Total', 'Profit']],
        body: filteredSales.value.map(row => [
          row.date, `#${row.order_id}`, row.customer || '-', formatNumber(row.items_count),
          formatAmount(row.discount), formatAmount(row.total), formatAmount(row.profit)
        ]),
        foot: [['', '', 'TOTALS', formatNumber(totalItemsSold.value), formatAmount(totalDiscount.value), formatAmount(totalSales.value), formatAmount(totalProfit.value)]],
        styles: { fontSize: 8 },
        headStyles: { fillColor: [59, 130, 246] },
        footStyles: { fillColor: [229, 231, 235], textColor: [31, 41, 55], fontStyle: 'bold' },
      });
      fileName = `sales-report-${startDate.value}-to-${endDate.value}.pdf`;
      doc.save(fileName);
    } else {
      doc.setFontSize(16);
      doc.text(`Inventory Valuation Report`, 14, 15);
      doc.setFontSize(9);
      doc.text(`Generated: ${now} | Stock Value: ${currencySymbol.value}${formatAmount(totalStockValue.value)} | Retail Value: ${currencySymbol.value}${formatAmount(totalRetailValue.value)}`, 14, 22);

      autoTable(doc, {
        startY: 28,
        head: [['Product', 'Category', 'Stock', 'Unit', 'Cost', 'Sell Price', 'Total Value']],
        body: filteredInventory.value.map(row => [
          row.name, row.category || '-', formatNumber(row.stock), row.unit || 'pcs',
          formatAmount(row.cost_price), formatAmount(row.selling_price), formatAmount(row.stock_value)
        ]),
        styles: { fontSize: 8 },
        headStyles: { fillColor: [139, 92, 246] },
      });
      fileName = `inventory-report-${now}.pdf`;
      doc.save(fileName);
    }

    showExportNotice('success', 'Report exported successfully', [fileName]);
  } catch (error) {
    console.error('Failed to export report:', error);
    showExportNotice('error', 'Failed to export report', [String(error?.message || error || 'Unknown error')]);
  }
}

onMounted(() => {
  const date = new Date();
  startDate.value = new Date(date.getFullYear(), date.getMonth(), 1).toISOString().split('T')[0];
  loadReport();
});

onBeforeUnmount(() => {
  if (exportNoticeTimer) {
    clearTimeout(exportNoticeTimer);
  }
});
</script>

<template>
  <div class="h-full flex flex-col space-y-6">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-0">
      <div>
        <h1 class="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight">Reports & Analytics</h1>
        <p class="text-xs sm:text-sm text-gray-400 font-medium">Comprehensive business intelligence</p>
      </div>
      <button @click="exportPDF"
        :disabled="(currentTab === 'sales' && filteredSales.length === 0) || (currentTab === 'inventory' && filteredInventory.length === 0)"
        class="w-full sm:w-auto justify-center bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white px-4 sm:px-6 py-2.5 rounded-xl sm:rounded-2xl shadow-lg shadow-emerald-500/20 flex items-center gap-2 font-bold text-sm transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed">
        <span>📄</span> Export PDF
      </button>
    </div>

    <!-- Controls Bar -->
    <div
      class="bg-white p-3 sm:p-4 rounded-xl sm:rounded-2xl shadow-sm border border-gray-100 flex flex-col xl:flex-row gap-4 justify-between items-start xl:items-center">
      <!-- Tabs -->
      <div class="flex bg-gray-100 p-1 rounded-xl w-full sm:w-auto overflow-x-auto">
        <button @click="currentTab = 'sales'; searchQuery = ''; loadReport()"
          :class="{ 'bg-white shadow text-blue-600': currentTab === 'sales', 'text-gray-500 hover:text-gray-700': currentTab !== 'sales' }"
          class="flex-1 sm:flex-none px-4 sm:px-5 py-2 rounded-lg transition-all font-black text-[10px] sm:text-xs uppercase tracking-widest whitespace-nowrap">
          Sales & Profit
        </button>
        <button @click="currentTab = 'inventory'; searchQuery = ''; loadReport()"
          :class="{ 'bg-white shadow text-purple-600': currentTab === 'inventory', 'text-gray-500 hover:text-gray-700': currentTab !== 'inventory' }"
          class="flex-1 sm:flex-none px-4 sm:px-5 py-2 rounded-lg transition-all font-black text-[10px] sm:text-xs uppercase tracking-widest whitespace-nowrap">
          Inventory
        </button>
      </div>

      <!-- Search and Date Filter Container -->
      <div class="flex flex-col sm:flex-row gap-3 w-full xl:w-auto flex-wrap">
        <!-- Search -->
        <div class="relative w-full sm:w-64">
          <span class="absolute left-3 top-2.5 text-gray-400 text-sm">🔍</span>
          <input v-model="searchQuery" type="text" placeholder="Search..."
            class="w-full border border-gray-200 rounded-xl pl-9 pr-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-gray-50 transition-all">
        </div>

        <!-- Date Range (Sales only) -->
        <div v-if="currentTab === 'sales'" class="flex flex-col sm:flex-row flex-wrap gap-2 items-start sm:items-center w-full sm:w-auto">
          <div class="flex bg-gray-50 border border-gray-200 rounded-xl overflow-x-auto w-full sm:w-auto">
            <button
              v-for="p in [{ label: 'Today', key: 'today' }, { label: 'Week', key: 'week' }, { label: 'Month', key: 'month' }, { label: 'Year', key: 'year' }, { label: 'All', key: 'all' }]"
              :key="p.key" @click="setDatePreset(p.key)"
              class="flex-1 sm:flex-none px-3 py-1.5 text-[9px] sm:text-[10px] font-black uppercase tracking-widest hover:bg-blue-50 hover:text-blue-600 text-gray-500 transition-colors border-r border-gray-200 last:border-r-0 whitespace-nowrap">
              {{ p.label }}
            </button>
          </div>
          <div class="flex items-center gap-2 w-full sm:w-auto">
            <input v-model="startDate" type="date" class="border border-gray-200 rounded-lg px-2 py-1.5 text-xs bg-gray-50 flex-1 sm:flex-none">
            <span class="text-gray-300 text-xs font-bold">→</span>
            <input v-model="endDate" type="date" class="border border-gray-200 rounded-lg px-2 py-1.5 text-xs bg-gray-50 flex-1 sm:flex-none">
            <button @click="loadReport"
              class="bg-blue-600 text-white px-4 py-1.5 rounded-lg hover:bg-blue-700 text-xs font-bold transition-colors active:scale-95">Go</button>
          </div>
        </div>
      </div>
    </div>

    <!-- KPI Summary Cards -->
    <div v-if="currentTab === 'sales'" class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
      <div class="bg-blue-50 border border-blue-100 p-4 rounded-2xl text-left">
        <div class="text-[10px] font-black text-blue-500 uppercase tracking-widest">Total Revenue</div>
        <div class="text-xl font-black text-blue-800 mt-1">{{ currencySymbol }}{{ formatAmount(totalSales) }}</div>
      </div>
      <div class="bg-green-50 border border-green-100 p-4 rounded-2xl text-left">
        <div class="text-[10px] font-black text-green-500 uppercase tracking-widest">Net Profit</div>
        <div class="text-xl font-black text-green-800 mt-1">{{ currencySymbol }}{{ formatAmount(totalProfit) }}</div>
      </div>
      <div class="bg-amber-50 border border-amber-100 p-4 rounded-2xl text-left">
        <div class="text-[10px] font-black text-amber-500 uppercase tracking-widest">Discounts Given</div>
        <div class="text-xl font-black text-amber-800 mt-1">{{ currencySymbol }}{{ formatAmount(totalDiscount) }}</div>
      </div>
      <div class="bg-indigo-50 border border-indigo-100 p-4 rounded-2xl text-left">
        <div class="text-[10px] font-black text-indigo-500 uppercase tracking-widest">Total Orders</div>
        <div class="text-xl font-black text-indigo-800 mt-1">{{ formatNumber(totalOrderCount) }}</div>
      </div>
      <div class="bg-purple-50 border border-purple-100 p-4 rounded-2xl text-left">
        <div class="text-[10px] font-black text-purple-500 uppercase tracking-widest">Avg Order Value</div>
        <div class="text-xl font-black text-purple-800 mt-1">{{ currencySymbol }}{{ formatAmount(avgOrderValue) }}</div>
      </div>
      <!-- Expenses Card -->
      <div class="bg-rose-50 border border-rose-100 p-4 rounded-2xl text-left">
        <div class="text-[10px] font-black text-rose-500 uppercase tracking-widest">Total Expenses</div>
        <div class="text-xl font-black text-rose-800 mt-1">{{ currencySymbol }}{{ formatAmount(totalExpenses) }}</div>
      </div>
      <div class="bg-teal-50 border border-teal-100 p-4 rounded-2xl text-left">
        <div class="text-[10px] font-black text-teal-500 uppercase tracking-widest">Profit Margin</div>
        <div class="text-xl font-black text-teal-800 mt-1">{{ formatPercent(profitMargin) }}%</div>
      </div>
    </div>

    <div v-if="currentTab === 'inventory'" class="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
      <div class="bg-purple-50 border border-purple-100 p-3 sm:p-4 rounded-xl sm:rounded-2xl text-left">
        <div class="text-[9px] sm:text-[10px] font-black text-purple-500 uppercase tracking-widest truncate">Cost Value</div>
        <div class="text-lg sm:text-xl font-black text-purple-800 mt-1 truncate">{{ currencySymbol }}{{ formatAmount(totalStockValue) }}</div>
      </div>
      <div class="bg-blue-50 border border-blue-100 p-3 sm:p-4 rounded-xl sm:rounded-2xl text-left">
        <div class="text-[9px] sm:text-[10px] font-black text-blue-500 uppercase tracking-widest truncate">Retail Value</div>
        <div class="text-lg sm:text-xl font-black text-blue-800 mt-1 truncate">{{ currencySymbol }}{{ formatAmount(totalRetailValue) }}</div>
      </div>
      <div class="col-span-2 sm:col-span-1 bg-green-50 border border-green-100 p-3 sm:p-4 rounded-xl sm:rounded-2xl text-left">
        <div class="text-[9px] sm:text-[10px] font-black text-green-500 uppercase tracking-widest truncate">Potential Profit</div>
        <div class="text-lg sm:text-xl font-black text-green-800 mt-1 truncate">{{ currencySymbol }}{{ formatAmount(totalPotentialProfit) }}</div>
      </div>
      <div class="bg-red-50 border border-red-100 p-3 sm:p-4 rounded-xl sm:rounded-2xl text-left">
        <div class="text-[9px] sm:text-[10px] font-black text-red-500 uppercase tracking-widest truncate">Out of Stock</div>
        <div class="text-lg sm:text-xl font-black text-red-800 mt-1 truncate">{{ formatNumber(outOfStockCount) }}</div>
      </div>
      <div class="bg-amber-50 border border-amber-100 p-3 sm:p-4 rounded-xl sm:rounded-2xl text-left">
        <div class="text-[9px] sm:text-[10px] font-black text-amber-500 uppercase tracking-widest truncate">Low Stock</div>
        <div class="text-lg sm:text-xl font-black text-amber-800 mt-1 truncate">{{ formatNumber(lowStockCount) }}</div>
      </div>
    </div>

    <!-- Data Table -->
    <div class="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex-1 flex flex-col min-h-0">
      <div v-if="loading" class="flex-1 flex items-center justify-center">
        <div class="text-gray-400 font-bold text-sm animate-pulse">Loading report data...</div>
      </div>

      <!-- Sales Table -->
      <div v-else-if="currentTab === 'sales'" class="flex-1 overflow-auto">
        <table class="w-full text-left border-collapse min-w-[700px]">
          <thead class="bg-gray-50 text-[10px] font-black text-gray-400 uppercase tracking-widest sticky top-0 z-10">
            <tr>
              <th class="px-5 py-4 border-b border-gray-100">Date</th>
              <th class="px-5 py-4 border-b border-gray-100">Order #</th>
              <th class="px-5 py-4 border-b border-gray-100">Customer</th>
              <th class="px-5 py-4 border-b border-gray-100 text-center">Items</th>
              <th class="px-5 py-4 border-b border-gray-100 text-right">Discount</th>
              <th class="px-5 py-4 border-b border-gray-100 text-right">Total</th>
              <th class="px-5 py-4 border-b border-gray-100 text-right">Profit</th>
            </tr>
          </thead>
          <tbody class="text-gray-700 text-sm">
            <tr v-for="item in filteredSales" :key="item.order_id"
              class="hover:bg-blue-50/30 border-b border-gray-50 last:border-b-0 transition-colors">
              <td class="px-5 py-3.5 text-xs text-gray-500 font-mono">{{ item.date }}</td>
              <td class="px-5 py-3.5 font-bold text-blue-600">#{{ item.order_id }}</td>
              <td class="px-5 py-3.5">{{ item.customer || '—' }}</td>
              <td class="px-5 py-3.5 text-center">
                <span class="bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full text-[10px] font-black">{{
                  formatNumber(item.items_count) }}</span>
              </td>
              <td class="px-5 py-3.5 text-right text-amber-600 text-xs">{{ item.discount > 0 ?
                `-${currencySymbol}${formatAmount(item.discount)}` : '—' }}</td>
              <td class="px-5 py-3.5 text-right font-bold">{{ currencySymbol }}{{ formatAmount(item.total) }}</td>
              <td class="px-5 py-3.5 text-right font-black"
                :class="item.profit >= 0 ? 'text-green-600' : 'text-red-500'">
                {{ currencySymbol }}{{ formatAmount(item.profit) }}
              </td>
            </tr>
            <tr v-if="filteredSales.length === 0">
              <td colspan="7" class="px-5 py-16 text-center">
                <div class="text-gray-300 text-4xl mb-2">📊</div>
                <div class="text-gray-400 font-bold text-sm">No sales data found for the selected period</div>
                <div class="text-gray-300 text-xs mt-1">Try adjusting the date range or search filters</div>
              </td>
            </tr>
          </tbody>
          <tfoot v-if="filteredSales.length > 0" class="bg-gray-50 font-black text-sm sticky bottom-0">
            <tr>
              <td class="px-5 py-4 text-gray-500" colspan="3">TOTALS ({{ formatNumber(totalOrderCount) }} orders)</td>
              <td class="px-5 py-4 text-center text-gray-700">{{ formatNumber(totalItemsSold) }}</td>
              <td class="px-5 py-4 text-right text-amber-600">{{ currencySymbol }}{{ formatAmount(totalDiscount) }}</td>
              <td class="px-5 py-4 text-right text-blue-700">{{ currencySymbol }}{{ formatAmount(totalSales) }}</td>
              <td class="px-5 py-4 text-right text-green-700">{{ currencySymbol }}{{ formatAmount(totalProfit) }}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <!-- Inventory Table -->
      <div v-else-if="currentTab === 'inventory'" class="flex-1 overflow-auto">
        <table class="w-full text-left border-collapse min-w-[800px]">
          <thead class="bg-gray-50 text-[10px] font-black text-gray-400 uppercase tracking-widest sticky top-0 z-10">
            <tr>
              <th class="px-5 py-4 border-b border-gray-100">Product</th>
              <th class="px-5 py-4 border-b border-gray-100">Category</th>
              <th class="px-5 py-4 border-b border-gray-100 text-center">Stock</th>
              <th class="px-5 py-4 border-b border-gray-100 text-right">Avg Cost</th>
              <th class="px-5 py-4 border-b border-gray-100 text-right">Sell Price</th>
              <th class="px-5 py-4 border-b border-gray-100 text-right">Margin</th>
              <th class="px-5 py-4 border-b border-gray-100 text-right">Stock Value</th>
            </tr>
          </thead>
          <tbody class="text-gray-700 text-sm">
            <tr v-for="item in filteredInventory" :key="item.id"
              class="hover:bg-purple-50/30 border-b border-gray-50 last:border-b-0 transition-colors">
              <td class="px-5 py-3.5 font-bold text-gray-800">{{ item.name }}</td>
              <td class="px-5 py-3.5">
                <span v-if="item.category"
                  class="bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full text-[10px] font-black uppercase">{{
                    item.category }}</span>
                <span v-else class="text-gray-300">—</span>
              </td>
              <td class="px-5 py-3.5 text-center">
                <span class="px-2 py-0.5 rounded-full text-[11px] font-black"
                  :class="item.stock <= 0 ? 'bg-red-100 text-red-600' : item.stock <= 5 ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'">
                  {{ formatNumber(item.stock) }} {{ item.unit || 'pcs' }}
                </span>
              </td>
              <td class="px-5 py-3.5 text-right text-gray-600">{{ currencySymbol }}{{ formatAmount(item.cost_price) }}</td>
              <td class="px-5 py-3.5 text-right font-bold">{{ currencySymbol }}{{ formatAmount(item.selling_price) }}</td>
              <td class="px-5 py-3.5 text-right">
                <span class="font-black text-xs"
                  :class="item.selling_price > item.cost_price ? 'text-green-600' : 'text-red-500'">
                  {{ item.cost_price > 0 ? formatPercent(((item.selling_price - item.cost_price) / item.cost_price) * 100)
                    : '—' }}%
                </span>
              </td>
              <td class="px-5 py-3.5 text-right font-black text-purple-700">{{ currencySymbol }}{{
                formatAmount(item.stock_value) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div v-if="exportNotice.visible"
      class="fixed right-4 bottom-4 z-[120] w-[min(560px,calc(100vw-2rem))] rounded-2xl border px-4 py-3 shadow-2xl"
      :class="exportNotice.type === 'success'
        ? 'bg-emerald-500 border-emerald-400 text-white'
        : 'bg-rose-500 border-rose-400 text-white'">
      <div class="flex items-start gap-3">
        <span class="text-xl leading-none">{{ exportNotice.type === 'success' ? '✓' : '!' }}</span>
        <div class="flex-1 min-w-0">
          <p class="text-lg font-black leading-tight">{{ exportNotice.title }}</p>
          <p v-for="(line, idx) in exportNotice.lines" :key="idx" class="mt-1 text-sm font-semibold break-all">
            {{ line }}
          </p>
        </div>
        <button @click="closeExportNotice" class="text-white/90 hover:text-white text-2xl leading-none">×</button>
      </div>
    </div>
  </div>
</template>
