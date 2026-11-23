/**
 * Cau hinh 5 cong noi bo FPT va cac thao tac chuan hoa Ma Hop Dong.
 */

export const PORTAL_ORDER = ['inside', 'port', 'camera', 'recall', 'radius'];

export const PORTALS = {
  inside: {
    id: 'inside',
    label: 'Inside',
    fullName: 'inside.fpt.net',
    url: 'http://inside.fpt.net/default.asp',
    hosts: ['inside.fpt.net', 'mvc.inside.fpt.net'],
    status: 'priority',
    statusLabel: 'Đủ 5 lệnh',
    description: 'Tra thông tin HĐ, Reset MAC Modem/Box, Kill Session, Clear OSP.',
    actions: [
      {
        id: 'lookup',
        label: 'Tra thông tin HĐ',
        description: 'Xem nhanh trạng thái thuê bao, MAC, phiên kết nối và OSP.',
        kind: 'primary',
        requiresConfirm: false,
      },
      {
        id: 'reset_mac',
        label: 'Reset MAC Modem',
        description: 'Xem MAC Modem đang chạy của hợp đồng, xóa trắng hoặc đổi MAC mới.',
        kind: 'danger',
        requiresConfirm: true,
        confirmNote: 'Kiểm tra MAC Modem đang chạy trước khi xóa trắng hoặc cập nhật MAC mới.',
      },
      {
        id: 'reset_mac_box',
        label: 'Reset MAC Box',
        description: 'Xem danh sách MAC Box, thay thế MAC mới (12/16 ký tự) và xem lịch sử Reset MAC.',
        kind: 'danger',
        requiresConfirm: true,
        confirmNote: 'Chọn đúng MAC Box cần thay thế trên hợp đồng và nhập MAC Box mới.',
      },
      {
        id: 'kill_session',
        label: 'Kill Session',
        description: 'Ngắt phiên PPPoE/kết nối hiện tại để thiết bị quay lại phiên mới.',
        kind: 'danger',
        requiresConfirm: true,
        confirmNote: 'Khách hàng có thể mất mạng vài giây trong lúc thiết bị kết nối lại.',
      },
      {
        id: 'clear_osp',
        label: 'Clear OSP',
        description: 'Xem Thông số kết nối (OLT/Port của HĐ) và chạy Clear Serial trên MonitorOLT.',
        kind: 'danger',
        requiresConfirm: true,
        requiresContract: false,
        confirmNote: 'Chọn đúng POP OLT và Port cần Clear Serial trước khi xác nhận.',
      },
    ],
  },
  port: {
    id: 'port',
    label: 'Port',
    fullName: 'port.fpt.net',
    url: 'http://port.fpt.net/',
    hosts: ['port.fpt.net', 'mvcport.fpt.net'],
    status: 'in_progress',
    statusLabel: 'Đang ghép',
    description: 'Kiểm tra, cấp mới và thu hồi Port cho hợp đồng.',
    actions: [
      {
        id: 'lookup_port',
        label: 'Xem Port hiện tại',
        description: 'Kiểm tra thông tin Port đang cấp cho hợp đồng.',
        kind: 'primary',
        requiresConfirm: false,
      },
      {
        id: 'assign_port',
        label: 'Cấp Port',
        description: 'Cấp Port mới cho hợp đồng trên port.fpt.net.',
        kind: 'danger',
        requiresConfirm: true,
        confirmNote: 'Xác nhận cấp Port cho hợp đồng đang chọn.',
      },
      {
        id: 'release_port',
        label: 'Thu hồi Port',
        description: 'Thu hồi Port hiện tại khỏi hợp đồng.',
        kind: 'danger',
        requiresConfirm: true,
        confirmNote: 'Thu hồi Port sẽ giải phóng tài nguyên port của hợp đồng này.',
      },
    ],
  },
  camera: {
    id: 'camera',
    label: 'Camera',
    fullName: 'fli-mngt.fcam.vn',
    url: 'https://fli-mngt.fcam.vn/',
    hosts: ['fli-mngt.fcam.vn'],
    status: 'planned',
    statusLabel: 'Sắp ghép',
    description: 'Kiểm tra trạng thái và hỗ trợ xử lý lỗi Camera.',
    actions: [
      {
        id: 'check_camera',
        label: 'Kiểm tra lỗi Camera',
        description: 'Xem tình trạng kết nối và cảnh báo lỗi Camera của hợp đồng.',
        kind: 'primary',
        requiresConfirm: false,
      },
      {
        id: 'reboot_camera',
        label: 'Khởi động lại Camera',
        description: 'Gửi lệnh khởi động lại thiết bị Camera từ xa.',
        kind: 'danger',
        requiresConfirm: true,
        confirmNote: 'Thiết bị Camera sẽ tạm ngắt hình trong lúc khởi động lại.',
      },
    ],
  },
  recall: {
    id: 'recall',
    label: 'Vật tư',
    fullName: 'nextgen.fpt.net/resource/recall',
    url: 'https://nextgen.fpt.net/resource/recall',
    hosts: ['nextgen.fpt.net'],
    status: 'planned',
    statusLabel: 'Sắp ghép',
    description: 'Tra cứu và cập nhật các vật tư thu hồi theo hợp đồng.',
    actions: [
      {
        id: 'lookup_recall',
        label: 'Xem vật tư thu hồi',
        description: 'Tra cứu danh sách thiết bị/vật tư cần thu hồi của hợp đồng.',
        kind: 'primary',
        requiresConfirm: false,
      },
      {
        id: 'update_recall',
        label: 'Cập nhật thu hồi',
        description: 'Ghi nhận trạng thái thu hồi vật tư lên NextGen.',
        kind: 'danger',
        requiresConfirm: true,
        confirmNote: 'Xác nhận cập nhật trạng thái vật tư thu hồi cho hợp đồng này.',
      },
    ],
  },
  radius: {
    id: 'radius',
    label: 'Radius',
    fullName: 'radius-portal.fpt.net',
    url: 'http://radius-portal.fpt.net/networkConnection',
    hosts: ['radius-portal.fpt.net'],
    status: 'planned',
    statusLabel: 'Sắp ghép',
    description: 'Kiểm tra kết nối và bỏ IPNAT, IPv6 cho hợp đồng.',
    actions: [
      {
        id: 'check_radius',
        label: 'Kiểm tra kết nối',
        description: 'Xem cấu hình IPNAT, IPv6 hiện tại trên Radius Portal.',
        kind: 'primary',
        requiresConfirm: false,
      },
      {
        id: 'remove_ipnat',
        label: 'Bỏ IPNAT',
        description: 'Gỡ cấu hình IPNAT đang áp trên thuê bao.',
        kind: 'danger',
        requiresConfirm: true,
        confirmNote: 'Thao tác này sẽ bỏ IPNAT cho hợp đồng trên Radius Portal.',
      },
      {
        id: 'remove_ipv6',
        label: 'Bỏ IPv6',
        description: 'Tắt cấp phát IPv6 cho kết nối của hợp đồng.',
        kind: 'danger',
        requiresConfirm: true,
        confirmNote: 'Thao tác này sẽ bỏ IPv6 cho hợp đồng trên Radius Portal.',
      },
    ],
  },
};

export const CONTRACT_REGEX = /^[A-Z0-9._-]{3,32}$/;

/**
 * Chuan hoa Ma Hop Dong: cat khoang trang thua, bo ky tu dieu khien, viet hoa.
 */
export function normalizeContractId(raw) {
  if (typeof raw !== 'string') {
    return '';
  }
  return raw
    .replace(/[\u0000-\u001F\u007F]/g, '')
    .replace(/\s+/g, '')
    .trim()
    .toUpperCase();
}

/**
 * Kiem tra hop le Ma Hop Dong truoc khi gui lenh.
 */
export function validateContractId(raw) {
  const value = normalizeContractId(raw);
  if (!value) {
    return {
      valid: false,
      value: '',
      error: 'Vui lòng nhập Mã hợp đồng trước khi thực hiện thao tác.',
    };
  }
  if (!CONTRACT_REGEX.test(value)) {
    return {
      valid: false,
      value,
      error: 'Mã hợp đồng chỉ gồm chữ, số, dấu gạch (- / _ / .) và dài từ 3 đến 32 ký tự.',
    };
  }
  return { valid: true, value, error: '' };
}
