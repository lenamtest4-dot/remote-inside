/**
 * Adapter xu ly cho cong port.fpt.net
 * Khi chua quet mau API that, se xac minh phien IAM va huong dan quet mau 1 cham.
 */

import { PORTALS, validateContractId } from '../config/portals.js';
import { checkPortalSession, isUserscriptEnv, sleep } from '../core/transport.js';

/**
 * Ban do endpoint that cua port.fpt.net se duoc dien vao day sau buoc Quet cau truc.
 */
export const PORT_ENDPOINTS = {
  lookup_port: null,
  assign_port: null,
  release_port: null,
};

function buildPortMockResult(actionId, contractId) {
  switch (actionId) {
    case 'lookup_port':
      return {
        status: 'ok',
        mode: 'demo',
        title: `Thông tin Port của ${contractId} (Dữ liệu mô phỏng)`,
        message:
          'Đã tải thông tin Port mẫu để kiểm tra giao diện trước khi ghép API thật của port.fpt.net.',
        summaryFields: [
          { label: 'Mã hợp đồng', value: contractId },
          { label: 'Trạng thái Port', value: 'Đang sử dụng (Đã cấp)' },
          { label: 'Thiết bị OLT/Switch', value: 'HCM-OLT-Q1-01 (Mô phỏng)' },
          { label: 'Card / Port PON', value: '0/3/12' },
          { label: 'Splitter / Cổng', value: 'SPL 1:16 • cổng 07' },
          { label: 'VLAN', value: 'VLAN 1001 (Internet)' },
          { label: 'Nguồn dữ liệu', value: 'Dữ liệu mô phỏng (chưa bật VPN/Userscript)' },
        ],
      };
    case 'assign_port':
      return {
        status: 'ok',
        mode: 'demo',
        title: `Đã cấp Port cho ${contractId} (Dữ liệu mô phỏng)`,
        message:
          'Lệnh mô phỏng thành công: Port mới đã được gán cho hợp đồng trên bản xem thử.',
      };
    case 'release_port':
      return {
        status: 'ok',
        mode: 'demo',
        title: `Đã thu hồi Port của ${contractId} (Dữ liệu mô phỏng)`,
        message:
          'Lệnh mô phỏng thành công: Port đã được giải phóng khỏi hợp đồng trên bản xem thử.',
      };
    default:
      return {
        status: 'error',
        mode: 'demo',
        message: 'Không nhận diện được thao tác yêu cầu.',
      };
  }
}

/**
 * Thuc thi mot lenh tren port.fpt.net.
 */
export async function runPortAction(actionId, rawContractId, ctx = {}) {
  const check = validateContractId(rawContractId);
  if (!check.valid) {
    return {
      status: 'validation_error',
      message: check.error,
    };
  }

  const contractId = check.value;
  const portal = PORTALS.port;

  if (!portal.actions.some((a) => a.id === actionId)) {
    return {
      status: 'error',
      message: 'Thao tác không hợp lệ trên cổng này.',
    };
  }

  if (!isUserscriptEnv() || ctx.forceDemo) {
    await sleep(350);
    return buildPortMockResult(actionId, contractId);
  }

  const endpoint = PORT_ENDPOINTS[actionId];
  if (!endpoint) {
    const session = await checkPortalSession(portal);
    if (session.state === 'iam_expired') {
      return {
        status: 'iam_expired',
        message:
          'Phiên đăng nhập IAM cho port.fpt.net đã hết hạn. Bấm nút bên dưới để đăng nhập lại.',
        loginUrl: session.loginUrl,
      };
    }
    if (session.state === 'offline') {
      return {
        status: 'error',
        message: session.detail,
        loginUrl: session.loginUrl,
      };
    }
    return {
      status: 'needs_scan',
      message:
        'Đã kết nối được port.fpt.net (IAM hợp lệ). Hãy mở trang port.fpt.net, bấm "Quét cấu trúc" để lấy mẫu thao tác thật ghép vào nút này.',
      hint: `Hoặc bấm "Mở trang port.fpt.net gốc" bên dưới (Mã HĐ ${contractId} đã sẵn sàng để dán).`,
      loginUrl: portal.url,
    };
  }

  return {
    status: 'needs_scan',
    message: 'Endpoint đang chờ cập nhật chi tiết.',
    loginUrl: portal.url,
  };
}
