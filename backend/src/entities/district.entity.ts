import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { DengueCase } from './dengue_case.entity';
import { WeatherData } from './weather_data.entity';

@Entity('districts')
export class District {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  name: string;

  @Column('decimal', { precision: 10, scale: 7 })
  latitude: number;

  @Column('decimal', { precision: 10, scale: 7 })
  longitude: number;

  @CreateDateColumn()
  created_at: Date;

  @OneToMany(() => DengueCase, (c) => c.district)
  cases: DengueCase[];

  @OneToMany(() => WeatherData, (w) => w.district)
  weather: WeatherData[];
}
