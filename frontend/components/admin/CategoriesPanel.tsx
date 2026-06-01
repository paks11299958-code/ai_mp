import React, { useState } from 'react';
import { Category } from '../../types';
import { categoryApi } from '../../services/apiService';
import { Icon } from '../Icons';

interface CategoriesPanelProps {
    // categories 상태는 페르소나 탭(PersonaInfoTab)과 공유되므로 AdminPanel 본체가 소유하고 주입한다.
    categories: Category[];
    setCategories: React.Dispatch<React.SetStateAction<Category[]>>;
}

export const CategoriesPanel: React.FC<CategoriesPanelProps> = ({ categories, setCategories }) => {
    const [newCategoryName, setNewCategoryName] = useState('');
    const [isSavingCategory, setIsSavingCategory] = useState(false);

    const createCategory = async () => {
        if (!newCategoryName.trim()) return;
        setIsSavingCategory(true);
        try {
            const cat = await categoryApi.create(newCategoryName.trim());
            setCategories(prev => [...prev, cat]);
            setNewCategoryName('');
        } catch (e: any) { alert(e.message); }
        finally { setIsSavingCategory(false); }
    };

    const deleteCategory = async (cat: Category) => {
        if (!window.confirm(`'${cat.name}' 카테고리를 삭제하시겠습니까?\n해당 카테고리의 페르소나는 미분류로 변경됩니다.`)) return;
        try {
            await categoryApi.delete(cat.id);
            setCategories(prev => prev.filter(c => c.id !== cat.id));
        } catch (e: any) { alert(e.message); }
    };

    return (
        <div className="flex-1 overflow-y-auto p-6">
            <h3 className="text-sm font-bold text-white mb-4">카테고리 관리</h3>
            <div className="flex gap-2 mb-4">
                <input
                    type="text"
                    value={newCategoryName}
                    onChange={e => setNewCategoryName(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !isSavingCategory) createCategory(); }}
                    placeholder="새 카테고리 이름"
                    className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                />
                <button
                    disabled={isSavingCategory || !newCategoryName.trim()}
                    onClick={createCategory}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors"
                >
                    추가
                </button>
            </div>
            <div className="space-y-2">
                {categories.length === 0 && (
                    <p className="text-gray-500 text-sm text-center py-8">카테고리가 없습니다.</p>
                )}
                {categories.map(cat => (
                    <div key={cat.id} className="flex items-center justify-between bg-gray-800 rounded-xl px-4 py-3">
                        <div>
                            <span className="text-sm font-medium text-white">{cat.name}</span>
                            <span className="ml-2 text-xs text-gray-500">({cat._count?.personas ?? 0}개)</span>
                        </div>
                        <button
                            onClick={() => deleteCategory(cat)}
                            className="text-gray-500 hover:text-red-400 transition-colors"
                        >
                            <Icon name="Trash2" size={14} />
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
};
