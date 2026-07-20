import { ScanAdminController } from './scan-admin.controller';

describe('ScanAdminController', () => {
  let controller: ScanAdminController;
  let repository: { findAndCount: jest.Mock; find: jest.Mock };
  let rescanJob: { rescanAssetById: jest.Mock };

  beforeEach(() => {
    repository = {
      findAndCount: jest.fn().mockResolvedValue([[{ id: 'asset-1' }], 1]),
      find: jest.fn().mockResolvedValue([{ id: 'asset-2', quarantined: true }]),
    };
    rescanJob = { rescanAssetById: jest.fn().mockResolvedValue(undefined) };

    controller = new ScanAdminController(
      repository as never,
      rescanJob as never,
    );
  });

  it('lists paginated scans filtered by status', async () => {
    const result = await controller.listScans('infected', 2, 10);

    expect(repository.findAndCount).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { scanStatus: 'infected' },
        take: 10,
        skip: 10,
      }),
    );
    expect(result).toEqual({
      items: [{ id: 'asset-1' }],
      total: 1,
      page: 2,
      pageSize: 10,
    });
  });

  it('lists quarantined assets', async () => {
    const result = await controller.listQuarantine();

    expect(repository.find).toHaveBeenCalledWith(
      expect.objectContaining({ where: { quarantined: true } }),
    );
    expect(result.items).toHaveLength(1);
  });

  it('triggers a manual rescan for an asset', async () => {
    const result = await controller.rescan('asset-1');

    expect(rescanJob.rescanAssetById).toHaveBeenCalledWith('asset-1');
    expect(result).toEqual({ assetId: 'asset-1', status: 'rescanned' });
  });
});
