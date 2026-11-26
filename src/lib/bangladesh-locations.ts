export interface LocationDivision {
  name: string;
  bnName: string;
  districts: {
    name: string;
    bnName: string;
    upazilas: string[];
  }[];
}

export const BANGLADESH_LOCATIONS: LocationDivision[] = [
  {
    name: 'Dhaka',
    bnName: 'ঢাকা বিভাগ',
    districts: [
      {
        name: 'Dhaka',
        bnName: 'ঢাকা',
        upazilas: ['Savar', 'Dhamrai', 'Keraniganj', 'Nawabganj', 'Dohar', 'Mirpur', 'Uttara', 'Dhanmondi', 'Motijheel', 'Mohammadpur'],
      },
      {
        name: 'Gazipur',
        bnName: 'গাজীপুর',
        upazilas: ['Gazipur Sadar', 'Kaliakair', 'Kaliganj', 'Kapasia', 'Sreepur', 'Tongi'],
      },
      {
        name: 'Narayanganj',
        bnName: 'নারায়ণগঞ্জ',
        upazilas: ['Narayanganj Sadar', 'Araihazar', 'Bandar', 'Rupganj', 'Sonargaon'],
      },
      {
        name: 'Tangail',
        bnName: 'টাঙ্গাইল',
        upazilas: ['Tangail Sadar', 'Basail', 'Bhuapur', 'Delduar', 'Ghatail', 'Kalihati', 'Madhupur', 'Mirzapur', 'Sakhipur'],
      },
    ],
  },
  {
    name: 'Khulna',
    bnName: 'খুলনা বিভাগ',
    districts: [
      {
        name: 'Kushtia',
        bnName: 'কুষ্টিয়া',
        upazilas: ['Kushtia Sadar', 'Kumarkhali', 'Khoksa', 'Mirpur', 'Bheramara', 'Daulatpur'],
      },
      {
        name: 'Khulna',
        bnName: 'খুলনা',
        upazilas: ['Khulna Sadar', 'Batiaghata', 'Dacope', 'Dumuria', 'Dighalia', 'Koyra', 'Paikgachha', 'Phultala', 'Rupsha'],
      },
      {
        name: 'Jashore',
        bnName: 'যশোর',
        upazilas: ['Jashore Sadar', 'Abhaynagar', 'Bagherpara', 'Chaugachha', 'Jhikargachha', 'Keshabpur', 'Manirampur', 'Sharsha'],
      },
    ],
  },
  {
    name: 'Chattogram',
    bnName: 'চট্টগ্রাম বিভাগ',
    districts: [
      {
        name: 'Chattogram',
        bnName: 'চট্টগ্রাম',
        upazilas: ['Chattogram Sadar', 'Anwara', 'Banshkhali', 'Boalkhali', 'Hathazari', 'Mirsharai', 'Patiya', 'Rangunia', 'Raozan', 'Sitakunda'],
      },
      {
        name: "Cox's Bazar",
        bnName: 'কক্সবাজার',
        upazilas: ["Cox's Bazar Sadar", 'Chakaria', 'Kutubdia', 'Maheshkhali', 'Ramu', 'Teknaf', 'Ukhia'],
      },
      {
        name: 'Cumilla',
        bnName: 'কুমিল্লা',
        upazilas: ['Cumilla Sadar', 'Barura', 'Brahmanpara', 'Burichang', 'Chandina', 'Chauddagram', 'Daudkandi', 'Debidwar', 'Laksam', 'Muradnagar'],
      },
    ],
  },
  {
    name: 'Rajshahi',
    bnName: 'রাজশাহী বিভাগ',
    districts: [
      {
        name: 'Rajshahi',
        bnName: 'রাজশাহী',
        upazilas: ['Rajshahi Sadar', 'Bagha', 'Bagmara', 'Charghat', 'Durgapur', 'Godagari', 'Mohanpur', 'Paba', 'Puthia', 'Tanore'],
      },
      {
        name: 'Bogura',
        bnName: 'বগুড়া',
        upazilas: ['Bogura Sadar', 'Adamdighi', 'Dhunat', 'Dupchanchia', 'Gabtali', 'Kahaloo', 'Nandigram', 'Sariakandi', 'Sherpur', 'Shibganj'],
      },
    ],
  },
  {
    name: 'Sylhet',
    bnName: 'সিলেট বিভাগ',
    districts: [
      {
        name: 'Sylhet',
        bnName: 'সিলেট',
        upazilas: ['Sylhet Sadar', 'Beanibazar', 'Bishwanath', 'Companiganj', 'Fenchuganj', 'Golapganj', 'Gowainghat', 'Jaintiapur', 'Kanaighat', 'Zakiganj'],
      },
      {
        name: 'Moulvibazar',
        bnName: 'মৌলভীবাজার',
        upazilas: ['Moulvibazar Sadar', 'Barlekha', 'Juri', 'Kamalganj', 'Kulaura', 'Rajnagar', 'Sreemangal'],
      },
    ],
  },
  {
    name: 'Rangpur',
    bnName: 'রংপুর বিভাগ',
    districts: [
      {
        name: 'Rangpur',
        bnName: 'রংপুর',
        upazilas: ['Rangpur Sadar', 'Badarganj', 'Gangachara', 'Kaunia', 'Mithapukur', 'Pirgachha', 'Pirganj', 'Taraganj'],
      },
      {
        name: 'Dinajpur',
        bnName: 'দিনাজপুর',
        upazilas: ['Dinajpur Sadar', 'Birampur', 'Birganj', 'Biral', 'Bochaganj', 'Chirirbandar', 'Fulbari', 'Ghoraghat', 'Parbatipur'],
      },
    ],
  },
  {
    name: 'Barishal',
    bnName: 'বরিশাল বিভাগ',
    districts: [
      {
        name: 'Barishal',
        bnName: 'বরিশাল',
        upazilas: ['Barishal Sadar', 'Agailjhara', 'Babuganj', 'Bakerganj', 'Banaripara', 'Gaurnadi', 'Hizla', 'Mehendiganj', 'Muladi', 'Wazirpur'],
      },
    ],
  },
  {
    name: 'Mymensingh',
    bnName: 'ময়মনসিংহ বিভাগ',
    districts: [
      {
        name: 'Mymensingh',
        bnName: 'ময়মনসিংহ',
        upazilas: ['Mymensingh Sadar', 'Bhaluka', 'Dhobaura', 'Fulbaria', 'Gaffargaon', 'Gauripur', 'Haluaghat', 'Ishwarganj', 'Muktagachha', 'Trishal'],
      },
    ],
  },
];

export const POST_TYPES = [
  { value: 'Breaking News', label: 'ব্রেকিং নিউজ (Breaking News)' },
  { value: 'Local News', label: 'স্থানীয় সংবাদ (Local News)' },
  { value: 'National News', label: 'জাতীয় সংবাদ (National News)' },
  { value: 'International News', label: 'আন্তর্জাতিক সংবাদ (International)' },
  { value: 'Politics', label: 'রাজনীতি (Politics)' },
  { value: 'Crime', label: 'অপরাধ (Crime)' },
  { value: 'Accident', label: 'দুর্ঘটনা (Accident)' },
  { value: 'Education', label: 'শিক্ষা ও ক্যাম্পাস (Education)' },
  { value: 'Sports', label: 'খেলাধুলা (Sports)' },
  { value: 'Entertainment', label: 'বিনোদন (Entertainment)' },
  { value: 'Business', label: 'ব্যবসা ও অর্থনীতি (Business)' },
  { value: 'Technology', label: 'প্রযুক্তি (Technology)' },
  { value: 'Health', label: 'স্বাস্থ্য (Health)' },
  { value: 'Agriculture', label: 'কৃষি ও গ্রামীণ জীবন (Agriculture)' },
  { value: 'Weather', label: 'আবহাওয়া (Weather)' },
  { value: 'Community News', label: 'কমিউনিটি ও সামাজিক (Community)' },
  { value: 'Jobs', label: 'চাকরি ও কর্মসংস্থান (Jobs)' },
  { value: 'Public Announcement', label: 'জনসচেতনতা ও বিজ্ঞপ্তি (Public Notice)' },
];

export const REPORT_REASONS = [
  'Fake News',
  'Misleading Information',
  'Copyright',
  'Violence',
  'Hate Speech',
  'Spam',
  'Harassment',
  'Adult Content',
  'False Information',
  'Other',
];

export const REACTION_TYPES = [
  { key: 'like', label: 'Like', emoji: '👍' },
  { key: 'love', label: 'Love', emoji: '❤️' },
  { key: 'wow', label: 'Wow', emoji: '😮' },
  { key: 'haha', label: 'Haha', emoji: '😂' },
  { key: 'sad', label: 'Sad', emoji: '😢' },
  { key: 'angry', label: 'Angry', emoji: '😡' },
] as const;

export const CREATOR_LEVELS = [
  { level: 1, name: 'New Creator', bnName: 'নতুন ক্রিয়েটর', minFollowers: 0, minViews: 0 },
  { level: 2, name: 'Active Creator', bnName: 'সক্রিয় ক্রিয়েটর', minFollowers: 100, minViews: 1000 },
  { level: 3, name: 'Popular Creator', bnName: 'জনপ্রিয় ক্রিয়েটর', minFollowers: 500, minViews: 5000 },
  { level: 4, name: 'Verified Creator', bnName: 'ভেরিফায়েড ক্রিয়েটর', minFollowers: 1000, minViews: 10000 },
  { level: 5, name: 'Top Creator', bnName: 'শীর্ষ ক্রিয়েটর', minFollowers: 5000, minViews: 50000 },
];

export type AdminRole =
  | 'super_admin'
  | 'admin'
  | 'news_editor'
  | 'moderator'
  | 'finance_manager'
  | 'support_manager'
  | 'creator'
  | 'user';

export const ROLE_PERMISSIONS: Record<string, string[]> = {
  super_admin: ['*'],
  admin: ['users:manage', 'posts:moderate', 'media:moderate', 'reports:manage', 'verification:manage', 'monetization:manage', 'ads:manage', 'payments:manage', 'settings:manage', 'audit:view'],
  news_editor: ['posts:moderate', 'posts:breaking', 'posts:feature'],
  moderator: ['posts:moderate', 'media:moderate', 'reports:manage', 'comments:moderate'],
  finance_manager: ['monetization:view', 'payments:manage', 'ads:view', 'fraud:view'],
  support_manager: ['users:view', 'reports:view', 'verification:view', 'copyright:view'],
  creator: [],
  user: [],
};

export function hasPermission(role: string, permission: string): boolean {
  const perms = ROLE_PERMISSIONS[role] || [];
  return perms.includes('*') || perms.includes(permission);
}
