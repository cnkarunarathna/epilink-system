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

@Entity('weather_data')
@Index(['district', 'year', 'week'], { unique: true })
export class WeatherData {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => District, (d) => d.weather, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'district_id' })
  district: District;

  @Column('int')
  year: number;

  @Column('int')
  week: number;

  @Column('decimal', { precision: 5, scale: 2, nullable: true })
  temperature_2m_mean: number | null;

  @Column('decimal', { precision: 7, scale: 2, nullable: true })
  precipitation_sum: number | null;

  @CreateDateColumn()
  created_at: Date;
}
