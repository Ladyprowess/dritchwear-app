import { StyleSheet } from 'react-native';

export const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  headerTitle: { fontSize: 24, fontFamily: 'Inter-Bold', color: '#1F2937' },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  looksButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3EFF7',
    borderWidth: 1,
    borderColor: '#E6DDEF',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 8,
    gap: 6,
  },
  looksButtonText: { fontSize: 14, fontFamily: 'Inter-SemiBold', color: '#5A2D82' },

  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#5A2D82',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
  },
  addButtonText: { fontSize: 14, fontFamily: 'Inter-SemiBold', color: '#FFFFFF' },

  searchContainer: { paddingHorizontal: 20, marginBottom: 16 },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 48,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  searchInput: { flex: 1, marginLeft: 12, fontSize: 16, fontFamily: 'Inter-Regular', color: '#1F2937' },

  categoriesScroll: { maxHeight: 48, marginBottom: 16 },
  categoriesContent: { paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 8 },

  categoryChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  categoryChipActive: { backgroundColor: '#5A2D82', borderColor: '#5A2D82' },
  categoryText: { fontSize: 14, fontFamily: 'Inter-Medium', color: '#6B7280' },
  categoryTextActive: { color: '#FFFFFF' },

  loadingContainer: { alignItems: 'center', paddingVertical: 40 },
  loadingText: { fontSize: 16, fontFamily: 'Inter-Regular', color: '#6B7280' },

  productsContainer: { paddingHorizontal: 20, paddingBottom: 20 },

  productCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  productHeader: { flexDirection: 'row' },
  productImage: { width: 80, height: 80, borderRadius: 8, marginRight: 12 },
  productInfo: { flex: 1 },

  productTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  productName: { flex: 1, fontSize: 16, fontFamily: 'Inter-SemiBold', color: '#1F2937', marginRight: 8 },

  productActions: { flexDirection: 'row', gap: 6 },
  actionButton: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  infoButton: { backgroundColor: '#6B7280' },
  editButton: { backgroundColor: '#3B82F6' },
  deleteButton: { backgroundColor: '#EF4444' },

  productDescription: { fontSize: 14, fontFamily: 'Inter-Regular', color: '#6B7280', marginBottom: 8, lineHeight: 18 },

  productMeta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  productPrice: { fontSize: 16, fontFamily: 'Inter-Bold', color: '#5A2D82' },

  productCategoriesWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'flex-end' },
  productCategory: {
    fontSize: 11,
    fontFamily: 'Inter-Medium',
    color: '#9CA3AF',
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },

  productDetails: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  stockContainer: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  productStock: { fontSize: 12, fontFamily: 'Inter-SemiBold' },

  lowStockBadge: { backgroundColor: '#FEF3C7', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  lowStockText: { fontSize: 10, fontFamily: 'Inter-SemiBold', color: '#F59E0B' },

  outOfStockBadge: { backgroundColor: '#FEE2E2', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  outOfStockText: { fontSize: 10, fontFamily: 'Inter-SemiBold', color: '#EF4444' },

  statusButton: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, gap: 4 },
  activeStatus: { backgroundColor: '#D1FAE5' },
  inactiveStatus: { backgroundColor: '#FEE2E2' },
  statusText: { fontSize: 10, fontFamily: 'Inter-SemiBold' },

  emptyContainer: { alignItems: 'center', paddingVertical: 60, paddingHorizontal: 40 },
  emptyTitle: { fontSize: 20, fontFamily: 'Inter-Bold', color: '#1F2937', marginTop: 16, marginBottom: 8 },
  emptySubtitle: { fontSize: 16, fontFamily: 'Inter-Regular', color: '#6B7280', textAlign: 'center', lineHeight: 24 },

  modalContainer: { flex: 1, backgroundColor: '#FFFFFF' },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modalTitle: { fontSize: 20, fontFamily: 'Inter-Bold', color: '#1F2937' },
  modalActions: { flexDirection: 'row', gap: 8 },

  cancelButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center' },
  saveButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#5A2D82', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8, gap: 6 },
  saveButtonText: { fontSize: 14, fontFamily: 'Inter-SemiBold', color: '#FFFFFF' },

  modalContent: { flex: 1, paddingHorizontal: 20, paddingVertical: 16 },
  modalContentWide: { width: '100%', maxWidth: 880, alignSelf: 'center', paddingHorizontal: 32 },

  formGroup: { marginBottom: 20 },
  formRow: { flexDirection: 'row', alignItems: 'flex-start' },

  formLabel: { fontSize: 14, fontFamily: 'Inter-SemiBold', color: '#374151', marginBottom: 8 },
  helperText: { fontSize: 12, fontFamily: 'Inter-Regular', color: '#9CA3AF', marginTop: 6 },
  sizeStockGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 10 },
  sizeStockItem: { width: 72 },
  sizeStockLabel: { fontSize: 12, fontFamily: 'Inter-SemiBold', color: '#374151', marginBottom: 4, textAlign: 'center' },
  sizeStockInput: { borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, paddingVertical: 8, textAlign: 'center', fontFamily: 'Inter-Regular', fontSize: 14, color: '#1F2937' },

  formInput: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#1F2937',
    backgroundColor: '#FFFFFF',
  },
  textArea: { minHeight: 80, textAlignVertical: 'top' },

  inputWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingHorizontal: 12,
    backgroundColor: '#FFFFFF',
  },
  formInputWithIcon: { flex: 1, paddingVertical: 12, paddingLeft: 8, fontSize: 16, fontFamily: 'Inter-Regular', color: '#1F2937' },

  formHint: { fontSize: 12, fontFamily: 'Inter-Regular', color: '#9CA3AF', marginTop: 4 },

  categorySelector: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  categoryOption: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16, backgroundColor: '#F3F4F6', borderWidth: 1, borderColor: '#E5E7EB' },
  categoryOptionActive: { backgroundColor: '#5A2D82', borderColor: '#5A2D82' },
  categoryOptionText: { fontSize: 12, fontFamily: 'Inter-Medium', color: '#6B7280' },
  categoryOptionTextActive: { color: '#FFFFFF' },

  imagePreview: { width: '100%', height: 120, borderRadius: 8, marginTop: 8 },

  toggleContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8 },
  toggleInfo: { flex: 1 },

  toggle: { width: 48, height: 28, borderRadius: 14, backgroundColor: '#E5E7EB', justifyContent: 'center', paddingHorizontal: 2 },
  toggleActive: { backgroundColor: '#5A2D82' },

  toggleThumb: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  featuredOnButton: {
    backgroundColor: '#F59E0B',
  },
  featuredOffButton: {
    backgroundColor: '#5A2D82',
  },
  featuredBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontFamily: 'Inter-Bold',
  },

  featuredOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  featuredCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
  },
  featuredTitle: {
    fontSize: 16,
    fontFamily: 'Inter-Bold',
    color: '#111827',
    marginBottom: 6,
  },
  featuredSubtitle: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    marginBottom: 12,
  },
  featuredInput: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#111827',
  },
  featuredActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 14,
  },
  featuredCancel: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#F3F4F6',
  },
  featuredCancelText: {
    fontSize: 13,
    fontFamily: 'Inter-SemiBold',
    color: '#374151',
  },
  featuredSave: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#5A2D82',
  },
  featuredSaveText: {
    fontSize: 13,
    fontFamily: 'Inter-SemiBold',
    color: '#FFFFFF',
  },

  toggleThumbActive: { transform: [{ translateX: 20 }] },
});
