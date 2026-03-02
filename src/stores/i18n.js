import { defineStore } from 'pinia';

const allowedLocales = ['en', 'id'];
const storedLocale = localStorage.getItem('locale') || 'en';
const initialLocale = allowedLocales.includes(storedLocale) ? storedLocale : 'en';

export const useI18nStore = defineStore('i18n', {
  state: () => ({
    locale: initialLocale,
    translations: {
      en: {
        dashboard: 'Dashboard',
        executive_dashboard: 'Executive Dashboard',
        precision_analytics: 'Precision Business Analytics',
        refresh_data: 'Refresh Data',
        inventory_valuation: 'Inventory Valuation',
        current_assets: 'Current Assets',
        lifetime_profit: 'Lifetime Profit',
        net_accrued: 'Net Accrued',
        active_orders: 'Active Orders',
        low_stock_items: 'Low Stock Items',
        operational_performance: 'Operational Performance',
        temporal_visualization: 'Temporal Data Visualization',
        sales: 'Sales',
        purchases: 'Purchases',
        profit: 'Profit',
        today: 'Today',
        this_month: 'This Month',
        this_year: 'This Year',
        procurement_today: 'Procurement Today',
        monthly_margin: 'Monthly Margin',
        annual_profit: 'Annual Profit',
        real_time_analysis: 'Real-time Margin Analysis',
        snapshot_accuracy: 'Snapshot Based Accuracy',
        fiscal_performance: 'Fiscal Year Performance',
        operational_shortcuts: 'Operational Shortcuts',
        checkout: 'Checkout',
        stock: 'Stock',
        receive: 'Receive',
        stats: 'Stats',
        system_integrity: 'System Integrity',
        catalog_size: 'Catalog Size',
        auth_status: 'Auth Status',
        last_updated: 'Last Updated',
        locale_name: 'English',
        fraud_checker: 'Fraud Check',
      },
      id: {
        dashboard: 'Dasbor',
        executive_dashboard: 'Dasbor Eksekutif',
        precision_analytics: 'Analitik Bisnis Presisi',
        refresh_data: 'Muat Ulang Data',
        inventory_valuation: 'Nilai Persediaan',
        current_assets: 'Aset Saat Ini',
        lifetime_profit: 'Total Laba',
        net_accrued: 'Akumulasi Bersih',
        active_orders: 'Pesanan Aktif',
        low_stock_items: 'Stok Menipis',
        operational_performance: 'Kinerja Operasional',
        temporal_visualization: 'Visualisasi Data Temporal',
        sales: 'Penjualan',
        purchases: 'Pembelian',
        profit: 'Laba',
        today: 'Hari Ini',
        this_month: 'Bulan Ini',
        this_year: 'Tahun Ini',
        procurement_today: 'Pengadaan Hari Ini',
        monthly_margin: 'Margin Bulanan',
        annual_profit: 'Laba Tahunan',
        real_time_analysis: 'Analisis Margin Real-time',
        snapshot_accuracy: 'Akurasi Berbasis Snapshot',
        fiscal_performance: 'Kinerja Tahun Fiskal',
        operational_shortcuts: 'Pintasan Operasional',
        checkout: 'Kasir',
        stock: 'Stok',
        receive: 'Penerimaan',
        stats: 'Statistik',
        system_integrity: 'Integritas Sistem',
        catalog_size: 'Ukuran Katalog',
        auth_status: 'Status Otorisasi',
        last_updated: 'Terakhir Diperbarui',
        locale_name: 'Indonesia',
        fraud_checker: 'Cek Fraud',
      },
    },
  }),
  getters: {
    t: (state) => (key) => {
      const localeTranslations = state.translations[state.locale] || state.translations.en;
      return localeTranslations[key] || key;
    },
  },
  actions: {
    setLocale(newLocale) {
      if (!allowedLocales.includes(newLocale)) {
        return;
      }
      this.locale = newLocale;
      localStorage.setItem('locale', newLocale);
    },
    toggleLocale() {
      const newLocale = this.locale === 'en' ? 'id' : 'en';
      this.setLocale(newLocale);
    },
  },
});
