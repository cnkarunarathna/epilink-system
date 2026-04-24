import { ObjectLiteral, Repository, SelectQueryBuilder } from 'typeorm';

export type MockRepository<T extends ObjectLiteral = any> = Partial<
  Record<keyof Repository<T>, jest.Mock>
>;

export type MockQueryBuilder<T extends ObjectLiteral = any> = Partial<
  Record<keyof SelectQueryBuilder<T>, jest.Mock>
>;

export function createMockQueryBuilder<T extends ObjectLiteral = any>(): MockQueryBuilder<T> {
  const qb: MockQueryBuilder<T> = {
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    from: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orWhere: jest.fn().mockReturnThis(),
    leftJoin: jest.fn().mockReturnThis(),
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    innerJoin: jest.fn().mockReturnThis(),
    innerJoinAndSelect: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    addOrderBy: jest.fn().mockReturnThis(),
    groupBy: jest.fn().mockReturnThis(),
    addGroupBy: jest.fn().mockReturnThis(),
    having: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    offset: jest.fn().mockReturnThis(),
    setParameter: jest.fn().mockReturnThis(),
    setParameters: jest.fn().mockReturnThis(),
    getMany: jest.fn().mockResolvedValue([]),
    getOne: jest.fn().mockResolvedValue(null),
    getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
    getRawMany: jest.fn().mockResolvedValue([]),
    getRawOne: jest.fn().mockResolvedValue(null),
    getCount: jest.fn().mockResolvedValue(0),
    execute: jest.fn().mockResolvedValue({ affected: 0 }),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
  };
  return qb;
}

export function createMockRepository<T extends ObjectLiteral = any>(): MockRepository<T> {
  return {
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn().mockResolvedValue(null),
    findOneBy: jest.fn().mockResolvedValue(null),
    findAndCount: jest.fn().mockResolvedValue([[], 0]),
    findBy: jest.fn().mockResolvedValue([]),
    save: jest.fn(),
    create: jest.fn(),
    update: jest.fn().mockResolvedValue({ affected: 1 }),
    delete: jest.fn().mockResolvedValue({ affected: 1 }),
    remove: jest.fn(),
    softRemove: jest.fn(),
    count: jest.fn().mockResolvedValue(0),
    countBy: jest.fn().mockResolvedValue(0),
    upsert: jest.fn(),
    insert: jest.fn(),
    merge: jest.fn(),
    preload: jest.fn(),
    exists: jest.fn().mockResolvedValue(false),
    existsBy: jest.fn().mockResolvedValue(false),
    createQueryBuilder: jest.fn(() => createMockQueryBuilder<T>()),
  };
}
