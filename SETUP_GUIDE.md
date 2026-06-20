# คู่มือตั้งค่ารอบบิล (Utility Meter + Automation)

วิธีนี้**ไม่ต้องเขียนโค้ด Node-RED** ใช้ Helper ของ Home Assistant ล้วนๆ บวก automation 2 ตัว เพื่อให้ทั้ง **รอบรายวันและรายเดือนตัดตรงชั่วโมงที่กำหนดเหมือนกัน** (รายเดือนตัดตรงวัน+ชั่วโมง, รายวันตัดตรงชั่วโมงทุกวัน) ไม่ใช่แค่เที่ยงคืนแบบ cycle เปล่าๆของ utility_meter

ทำตามลำดับนี้ **ห้ามสลับขั้นตอน** เพราะ automation ในขั้นที่ 4 ต้องอ้างถึง entity ที่สร้างในขั้นที่ 1-3 ก่อน

ความละเอียดสูงสุดที่ทำได้ด้วยวิธีนี้คือ**ระดับชั่วโมง** (ไม่มีนาที) — ถ้าต้องการละเอียดกว่านี้ต้องเพิ่ม `input_number` สำหรับนาทีและเปลี่ยน automation เป็นเช็คทุก 1 นาทีแทน (ไม่ได้ใช้ในคู่มือนี้)

## ขั้นที่ 1 — สร้าง Utility Meter Helper (4 ตัว)

Settings → Devices & services → แท็บ **Helpers** → **+ Create helper** → **Utility Meter**

สร้างทีละตัว โดย **Input sensor** ให้เลือก sensor มิเตอร์ดิบของจริง (ตัวที่ไล่ขึ้นตลอดไม่รีเซ็ตเอง เช่นจาก ESP32/PZEM) — Meter reset cycle ตอนสร้างเลือกอะไรก็ได้ไว้ก่อน เพราะจะกลับมาแก้เป็น Yearly ทั้งหมดในขั้นที่ 2:

| Name ที่ตั้ง | Input sensor |
|---|---|
| Daily Grid | sensor มิเตอร์กริดดิบ |
| Daily Load | sensor มิเตอร์โหลดดิบ |
| Monthly Grid | sensor มิเตอร์กริดดิบ (ตัวเดิม) |
| Monthly Load | sensor มิเตอร์โหลดดิบ (ตัวเดิม) |

## ขั้นที่ 2 — เปลี่ยน cycle ของทั้ง 4 ตัวเป็น Yearly

⚠️ **ห้ามข้ามขั้นนี้ — สำคัญมาก** ทั้ง 4 ตัว (ไม่ใช่แค่ Monthly เหมือนคู่มือเวอร์ชันก่อน) ต้องเปลี่ยนเป็น Yearly เพื่อปิดการ auto-reset ของ HA เองทั้งหมด แล้วปล่อยให้ automation ในขั้นที่ 4 เป็นคนสั่งรีเซ็ตทุกตัวแทน ไม่งั้นจะรีเซ็ตซ้อนกัน 2 รอบ (ทั้งจาก cycle เองและจาก automation) ข้อมูลจะเพี้ยน

ไปที่ **Daily Grid, Daily Load, Monthly Grid, Monthly Load** ทีละตัว → คลิกชื่อ entity → กดปุ่มตั้งค่า (เฟือง) → เปลี่ยน **Meter reset cycle เป็น Yearly** → บันทึก

## ขั้นที่ 3 — สร้าง Input Number Helper (2 ตัว)

Settings → Devices & services → Helpers → **+ Create helper** → **Number**

| Name | Entity ID | Min | Max | ค่าเริ่มต้น |
|---|---|---|---|---|
| PEA Cutoff Day | `input_number.pea_cutoff_day` | 1 | 31 | วันที่ตัดรอบจริง (ดูจากใบแจ้งหนี้ PEA) |
| PEA Cutoff Hour | `input_number.pea_cutoff_hour` | 0 | 23 | ชั่วโมงที่ตัดรอบจริง |

`pea_cutoff_hour` ใช้ร่วมกันทั้งรอบรายวันและรายเดือน — แก้ทีเดียวกระทบทั้งคู่

## ขั้นที่ 4 — สร้าง Automation 2 ตัว

Settings → Automations & scenes → **Create Automation** → กด `⋮` มุมขวาบน → **Edit in YAML** → วางทับด้วยอันนี้ (ทำซ้ำ 2 รอบ สร้างคนละตัว):

**Automation 1 — รีเซ็ตรายวัน ตรงชั่วโมงที่กำหนด ทุกวัน**

```yaml
alias: "Reset PEA daily cycle"
trigger:
  - trigger: time_pattern
    minutes: "/5"
condition:
  - condition: template
    value_template: >
      {{ now().hour == states('input_number.pea_cutoff_hour') | int(0)
         and now().minute < 5 }}
action:
  - action: utility_meter.reset
    target:
      entity_id:
        - sensor.smartmeter_2_phase_daily_grid
        - sensor.smartmeter_2_phase_daily_load
```

**Automation 2 — รีเซ็ตรายเดือน ตรงวัน+ชั่วโมงที่กำหนด**

```yaml
alias: "Reset PEA monthly cycle"
trigger:
  - trigger: time_pattern
    minutes: "/5"
condition:
  - condition: template
    value_template: >
      {{ now().day == states('input_number.pea_cutoff_day') | int(0)
         and now().hour == states('input_number.pea_cutoff_hour') | int(0)
         and now().minute < 5 }}
action:
  - action: utility_meter.reset
    target:
      entity_id:
        - sensor.smartmeter_2_phase_monthly_grid
        - sensor.smartmeter_2_phase_monthly_load
```

ทั้งสองตัวเช็คทุก 5 นาที (`minute < 5` กันยิงซ้ำหลายครั้งในชั่วโมงเดียวกัน) — รีเซ็ตจริงอาจคลาดจากเวลาที่ตั้งไว้ได้สูงสุด ~5 นาที

## ขั้นที่ 5 — ตั้งค่า Bill Energy Card

```yaml
type: custom:bill-energy-card
grid_entity_daily: sensor.smartmeter_2_phase_daily_grid
load_entity_daily: sensor.smartmeter_2_phase_daily_load
grid_entity_cycle: sensor.smartmeter_2_phase_monthly_grid
load_entity_cycle: sensor.smartmeter_2_phase_monthly_load
```

## หมายเหตุ

- ต้องรอให้ **Automation 1** ยิง reset ผ่านไปอย่างน้อย 1 ครั้งก่อน มุมมองรายวันจะมีข้อมูล (ไม่ใช่อัตโนมัติทันทีที่ติดตั้งเหมือนคู่มือเวอร์ชันก่อนแล้ว เพราะเปลี่ยนมาคุมด้วย automation ทั้งหมด)
- ต้องรอให้ **Automation 2** ยิง reset ผ่านไปอย่างน้อย 1 ครั้งก่อน มุมมองรายเดือนจะมีข้อมูล
- ถ้าจะเปลี่ยนวัน/ชั่วโมงตัดรอบในอนาคต แก้แค่ `input_number.pea_cutoff_day`/`pea_cutoff_hour` จากหน้า UI พอ ไม่ต้องแก้ automation
- อยากได้ละเอียดถึงระดับนาที: เพิ่ม `input_number.pea_cutoff_minute` (min 0 max 59) แล้วเปลี่ยน trigger ทั้ง 2 automation เป็น `minutes: "/1"` และเปลี่ยนเงื่อนไขจาก `minute < 5` เป็น `minute == states('input_number.pea_cutoff_minute') | int(0)`
