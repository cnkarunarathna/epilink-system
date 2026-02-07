import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  Index,
  JoinColumn,
} from 'typeorm';
import { District } from './district.entity';

@Entity('dengue_cases')
@Index(['district', 'year', 'week'], { unique: true })
export class DengueCase {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => District, (d) => d.cases, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'district_id' })
  district: District;

  @Column('int')
  year: number;

  @Column('int')
  week: number;

  @Column('int')
  cases: number;

  @CreateDateColumn()
  created_at: Date;
}
