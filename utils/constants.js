/**
 * 常量配置模块
 */

// 物品种类
const CATEGORIES = ['食物', '猫粮', '药品', '其他'];

// 种类映射 (中文 -> 英文)
const CATEGORY_MAP = {
  '食物': 'Food',
  '猫粮': 'CatFood',
  '药品': 'Medicine',
  '其他': 'Product'
};

// 种类映射 (英文 -> 中文)
const CATEGORY_MAP_REVERSE = {
  'Food': '食物',
  'CatFood': '猫粮',
  'Medicine': '药品',
  'Product': '其他'
};

// 种类 Emoji
const CATEGORY_EMOJI = {
  'Food': '🥖',
  'CatFood': '🐱',
  'Medicine': '💊'
};

// 存储条件
const STORAGES = ['冷藏', '冷冻', '常温'];

// 重量单位
const WEIGHT_UNITS = ['kg', 'pound'];

// 房间位置
const LOCATION_ROOMS = ['厨房', '客厅', '厕所', '卧室', '杂物间'];

// 具体位置
const LOCATION_SITES = ['冰箱冷藏室', '冰箱冷冻室', '柜子', '桌面', '其他'];

// 出行类型
const TRAVEL_TYPES = ['国内', '国外'];

// 出行状态
const TRAVEL_STATUS = {
  PENDING: 'Pending',
  VISITED: 'Visited'
};

// 国家列表
const COUNTRY_LIST = [
  '日本', '韩国', '美国', '英国', '法国', '德国', '意大利', '西班牙', 
  '葡萄牙', '荷兰', '比利时', '瑞士', '奥地利', '澳大利亚', '新西兰', 
  '加拿大', '墨西哥', '巴西', '阿根廷', '俄罗斯', '印度', '泰国', 
  '越南', '新加坡', '马来西亚', '印度尼西亚', '菲律宾', '埃及', 
  '南非', '土耳其', '希腊', '捷克', '波兰', '挪威', '瑞典', 
  '丹麦', '芬兰', '冰岛', '其他'
];

// ==================== 体检相关 ====================

// 检查项状态
const CHECKUP_STATUS = {
  Normal: '正常',
  High: '偏高',
  Low: '偏低',
  Abnormal: '异常'
};

// 体检人
const CHECKUP_OWNERS = ['Pig', 'Donkey'];
const CHECKUP_OWNER_CONFIG = {
  'Pig': { emoji: '🐷', name: '猪猪' },
  'Donkey': { emoji: '🫏', name: '毛驴' }
};

// 体检项分类
const CHECKUP_CATEGORIES = [
  '基础检查', '血常规', '尿常规', '肿瘤标志物', 
  '肝功能', '血糖', '肾功能', '血脂', '甲状腺', '其他'
];

// 体检预设模板分类及项目数量（实际定义存储在后端 metadata）
const CHECKUP_TEMPLATE_COUNTS = {
  '基础检查': 6,
  '血常规': 20,
  '尿常规': 3,
  '肿瘤标志物': 3,
  '肝功能': 5,
  '血糖': 1,
  '肾功能': 3,
  '血脂': 6,
  '甲状腺': 1,
  '其他': 1
};

module.exports = {
  CATEGORIES,
  CATEGORY_MAP,
  CATEGORY_MAP_REVERSE,
  CATEGORY_EMOJI,
  STORAGES,
  WEIGHT_UNITS,
  LOCATION_ROOMS,
  LOCATION_SITES,
  TRAVEL_TYPES,
  TRAVEL_STATUS,
  COUNTRY_LIST,
  // 体检相关
  CHECKUP_STATUS,
  CHECKUP_OWNERS,
  CHECKUP_OWNER_CONFIG,
  CHECKUP_CATEGORIES,
  CHECKUP_TEMPLATE_COUNTS
};
