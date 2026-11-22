/**
 * Adapter xu ly cho trang uu tien so 1: inside.fpt.net
 * Khi chua quet mau API that, se xac minh phien IAM va huong dan quet mau 1 cham.
 */

import { PORTALS, validateContractId } from '../config/portals.js';
import { checkPortalSession, isUserscriptEnv, sleep } from '../core/transport.js';

/**
 * Ban do endpoint that cua inside.fpt.net se duoc dien vao day sau buoc Quet cau truc.
 */
export const INSIDE_ENDPOINTS = {
  lookup: null,
  reset_mac: null,
  kill_session: null,
  clear_osp: null,
};

function buildInsideMockResult(actionId, contractId) {
  switch (actionId) {
    case 'lookup':
      return {
        status: 'ok',
        mode: 'demo',
        title: `Thông tin hợp đồng ${contractId} (Dữ liệu mô phỏng)`,
        message: 'Đã tải thông tin mẫu để bạn kiểm tra giao diện trước khi ghép API thật.',
        summaryFields: [
          { label: 'Mã hợp đồng', value: contractId },
          { label: 'Trạng thái thuê bao', value: 'Đang hoạt động (Online)' },
          { label: 'Gói cước', value: 'Sky / Giga 300Mbps (Mô phỏng)' },
          { label: 'Địa chỉ MAC hiện tại', value: 'A4:2B:8C:10:9E:4F' },
          { label: 'Phiên PPPoE', value: 'Đang giữ phiên • 1 giờ 42 phút' },
          { label: 'Trạng thái OSP', value: 'Đã đồng bộ port bình thường' },
          { label: 'Nguồn dữ liệu', value: 'Dữ liệu mô phỏng (chưa bật VPN/Userscript)' },
        ],
      };
    case 'reset_mac':
      return {
        status: 'ok',
        mode: 'demo',
        title: `Đã Reset MAC cho ${contractId} (Dữ liệu mô phỏng)`,
        message: 'Lệnh mô phỏng thành công: MAC cũ đã được xóa trên bản xem thử.',
      };
    case 'kill_session':
      return {
        status: 'ok',
        mode: 'demo',
        title: `Đã Kill Session cho ${contractId} (Dữ liệu mô phỏng)`,
        message: 'Lệnh mô phỏng thành công: Phiên PPPoE giả lập đã được ngắt để quay lại phiên mới.',
      };
    case 'clear_osp':
      return {
        status: 'ok',
        mode: 'demo',
        title: `Đã Clear OSP cho ${contractId} (Dữ liệu mô phỏng)`,
        message: 'Lệnh mô phỏng thành công: Dữ liệu OSP giả lập đã được làm sạch.',
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
 * Thuc thi mot lenh tren inside.fpt.net.
 */
export async function runInsideAction(actionId, rawContractId, ctx = {}) {
  const check = validateContractId(rawContractId);
  if (!check.valid) {
    return {
      status: 'validation_error',
      message: check.error,
    };
  }

  const contractId = check.value;
  const portal = PORTALS.inside;

  if (!isUserscriptEnv() || ctx.forceDemo) {
    await sleep(350);
    return buildInsideMockResult(actionId, contractId);
  }

  const endpoint = INSIDE_ENDPOINTS[actionId];
  if (!endpoint) {
    const session = await checkPortalSession(portal);
    if (session.state === 'iam_expired') {
      return {
        status: 'iam_expired',
        message: 'Phiên đăng nhập IAM đã hết hạn. Bấm nút bên dưới để đăng nhập lại.',
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
        'Đã kết nối được inside.fpt.net (IAM hợp lệ). Hãy bấm nút "Quét cấu trúc" ở góc trên để lấy mẫu thao tác thật ghép vào nút này.',
      hint: 'Hoặc bấm "Mở trang inside.fpt.net gốc" bên dưới (Mã HĐ đã sẵn sàng để dán).',
      loginUrl: portal.url,
    };
  }

  return {
    status: 'needs_scan',
    message: 'Endpoint đang chờ cập nhật chi tiết.',
    loginUrl: portal.url,
  };
}
