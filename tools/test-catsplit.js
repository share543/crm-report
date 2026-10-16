// v1.12.0 純函式測試：類別編碼合成、老客戶統計、樣板列判準
const M = require('/home/arthur/crm-fixture/tools/report-under-test.js');

let pass = 0, fail = 0;
function eq(name, got, want) {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g === w) { pass++; console.log('  ✓ ' + name); }
  else { fail++; console.log('  ✗ ' + name + '\n      got  = ' + g + '\n      want = ' + w); }
}
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  ✓ ' + name); }
  else { fail++; console.log('  ✗ ' + name + (extra ? '  → ' + extra : '')); }
}

const NEWH = ['序號', '公司名稱', '零擔', '1P(SCM)', '3P(MO+)', '甲配'];
const OLDH = ['序號', '公司名稱', '類別'];

console.log('【1】deriveCategoryFromTicks：優先序與旗標');
{
  const rows = [
    { '序號': '1', '零擔': 'V' },                        // → 零擔
    { '序號': '2', '1P(SCM)': 'V' },                     // → 1P
    { '序號': '3', '3P(MO+)': 'V' },                     // → 3P
    { '序號': '4', '零擔': 'V', '1P(SCM)': 'V' },         // 兩個都勾 → 零擔（優先序）
    { '序號': '5', '零擔': 'V', '3P(MO+)': 'V' },         // → 零擔
    { '序號': '6', '3P(MO+)': 'V', '甲配': 'V' },         // → 3P，且 _甲配
    { '序號': '7', '甲配': 'V' },                         // 只勾甲配 → 類別空
    { '序號': '8' },                                      // 全沒勾 → 類別空
    { '序號': '9', '零擔': '✓' },                         // 打勾變體 ✓
    { '序號': '10', '1P(SCM)': 'ｖ' }                      // 全形 ｖ
  ];
  const r = M.deriveCategoryFromTicks(rows, NEWH);
  eq('套用成功', r.applied, true);
  eq('類別值', rows.map(x => x['類別']), ['零擔', '1P(SCM)', '3P(MO+)', '零擔', '零擔', '3P(MO+)', '', '', '零擔', '1P(SCM)']);
  eq('零擔數', r.zhit, 4);
  eq('1P 數', r.p1, 2);
  eq('3P 數', r.p3, 2);
  eq('未分類數', r.none, 2);
  eq('多標籤列數', r.multi, 3);      // 第 4、5、6 列各有兩個勾
  eq('甲配旗標', rows[5]['_甲配'], true);
  eq('沒勾甲配的不設旗標', rows[0]['_甲配'], undefined);
  eq('回報的甲配數', r.jiapei, 2);
}

console.log('【2】deriveCategoryFromTicks：舊格式／無編碼欄不動');
{
  const rows = [{ '序號': '1', '類別': '甲指' }];
  const r = M.deriveCategoryFromTicks(rows, OLDH);
  eq('舊格式不套用', r.applied, false);
  eq('舊格式類別原封不動', rows[0]['類別'], '甲指');
  const r2 = M.deriveCategoryFromTicks([{ '序號': '1' }], ['序號', '公司名稱']);
  eq('沒有編碼欄也不套用', r2.applied, false);
  eq('沒有編碼欄不寫類別', '類別' in r2 ? 'has' : 'none', 'none');
}

console.log('【3】oldCustomerStats：新格式讀勾選欄，不受類別優先序影響');
{
  const rows = [
    { '序號': '1', '零擔': 'V', '1P(SCM)': 'V', '類別': '零擔' },  // 老客戶（關鍵案例）
    { '序號': '2', '3P(MO+)': 'V', '類別': '3P(MO+)' },
    { '序號': '3', '1P(SCM)': 'V', '3P(MO+)': 'V', '類別': '1P(SCM)' }, // 兩個都勾只算一筆
    { '序號': '4', '零擔': 'V', '類別': '零擔' },
    { '序號': '5', '類別': '' }
  ];
  const s = M.oldCustomerStats(rows, NEWH);
  eq('老客戶總數（同一列兩者都勾只算一筆）', s.total, 3);
  eq('1P 筆數', s.p1, 2);
  eq('3P 筆數', s.p3, 2);
}

console.log('【4】oldCustomerStats：舊格式讀 類別');
{
  const rows = [
    { '類別': '1P(SCM)' }, { '類別': '3P(MO+)' },
    { '類別': '零擔' }, { '類別': '' }, { '類別': '甲指' }
  ];
  const s = M.oldCustomerStats(rows, OLDH);
  eq('舊格式老客戶', s.total, 2);
  eq('舊格式 1P', s.p1, 1);
  eq('舊格式 3P', s.p3, 1);
}

console.log('【5】isTemplateRow 加嚴：一個 0 不該讓殘留列變成案件');
{
  ok('只有序號 → 樣板列', M.isTemplateRow({ '序號': '1' }));
  ok('序號 + 預估營收/月=0 → 樣板列', M.isTemplateRow({ '序號': '2', '預估營收/月': '0' }));
  ok('序號 + 空白字串 → 樣板列', M.isTemplateRow({ '序號': '3', '公司名稱': '   ' }));
  ok('有公司名稱 → 不是樣板列', !M.isTemplateRow({ '序號': '4', '公司名稱': '甲公司' }));
  ok('有填單日期 → 不是樣板列', !M.isTemplateRow({ '序號': '5', '填單日期': '2026-01-01' }));
  ok('有課別 → 不是樣板列', !M.isTemplateRow({ '序號': '6', '課別': '北一課' }));
  ok('有結案 → 不是樣板列', !M.isTemplateRow({ '序號': '7', '結案': '客戶婉拒' }));
}

console.log('\n通過 ' + pass + ' / 失敗 ' + fail);
process.exit(fail ? 1 : 0);
