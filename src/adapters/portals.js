/**
 * Bo dieu phoi thao tac chung cho ca 5 cong noi bo FPT.
 */

import { PORTALS, validateContractId } from '../config/portals.js';
import { checkPortalSession, isUserscriptEnv, sleep } from '../core/transport.js';
import { runInsideAction } from './inside.js';
import { runPortAction } from './port.js';
import { runRadiusAction } from './radius.js';
import { runRecallAction } from './recall.js';

function buildPlannedDemoResult(portal, action, contractId) {
  if (action.id.startsWith('lookup') || action.id.startsWith('check')) {
    return {
      status: 'ok',
      mode: 'demo',
      title: `${action.label} — ${contractId} (Dữ liệu mô phỏng)`,
      message: `Đang xem thử giao diện cho cổng ${portal.fullName}. Sau khi xong Inside sẽ ghép nối chạy thật cổng này.`,
      summaryFields: [
        { label: 'Cổng dịch vụ', value: portal.fullName },
        { label: 'Mã hợp đồng', value: contractId },
        { label: 'Trạng thái tích hợp', value: 'Chờ ghép API ở đợt tiếp theo' },
        { label: 'Ghi chú', value: 'Dữ liệu mô phỏng để kiểm tra thao tác trên điện thoại' },
      ],
    };
  }

  return {
    status: 'ok',
    mode: 'demo',
    title: `Đã chạy thử "${action.label}" cho ${contractId} (Dữ liệu mô phỏng)`,
    message: `Lệnh mô phỏng trên ${portal.fullName} hoàn tất. Khi ghép nối thật, thao tác sẽ chạy trực tiếp qua VPN & IAM.`,
  };
}

/**
 * Thuc thi hanh dong tu giao dien cho bat ky portal nao trong 5 cong.
 */
export async function executePortalAction(portalId, actionId, rawContractId, ctx = {}) {
  const portal = PORTALS[portalId];
  if (!portal) {
    return {
      status: 'error',
      message: 'Không tìm thấy cổng công cụ tương ứng.',
    };
  }

  if (portalId === 'inside') {
    return runInsideAction(actionId, rawContractId, ctx);
  }
  if (portalId === 'port') {
    return runPortAction(actionId, rawContractId, ctx);
  }
  if (portalId === 'recall') {
    return runRecallAction(actionId, rawContractId, ctx);
  }
  if (portalId === 'radius') {
    return runRadiusAction(actionId, rawContractId, ctx);
  }

  const check = validateContractId(rawContractId);
  if (!check.valid) {
    return {
      status: 'validation_error',
      message: check.error,
    };
  }

  const action = portal.actions.find((a) => a.id === actionId);
  if (!action) {
    return {
      status: 'error',
      message: 'Thao tác không hợp lệ trên cổng này.',
    };
  }

  const contractId = check.value;

  if (!isUserscriptEnv() || ctx.forceDemo) {
    await sleep(350);
    return buildPlannedDemoResult(portal, action, contractId);
  }

  const session = await checkPortalSession(portal);
  if (session.state === 'iam_expired') {
    return {
      status: 'iam_expired',
      message: `Phiên đăng nhập IAM cho ${portal.fullName} đã hết hạn. Bấm nút bên dưới để đăng nhập lại.`,
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
    message: `Đã xác nhận kết nối tới ${portal.fullName} (IAM hợp lệ). Cổng này đang chờ ghép nối ở đợt tiếp theo — bạn có thể bấm "Quét cấu trúc" ngay hoặc mở nhanh trang gốc với Mã HĐ đã sao chép.`,
    hint: `Mã HĐ ${contractId} đã được lưu vào danh sách gần đây để bạn dán nhanh.`,
    loginUrl: portal.url,
  };
}
