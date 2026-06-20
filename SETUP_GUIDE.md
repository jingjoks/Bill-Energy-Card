# คู่มือตั้งค่ารอบบิล (Utility Meter + Automation)

วิธีนี้**ไม่ต้องเขียนโค้ด Node-RED** ใช้ Helper ของ Home Assistant ล้วนๆ บวก automation เล็กๆ 1 ตัว เพื่อให้ "รอบบิลรายเดือน" ตัดตรงวัน+เวลาจริงที่ PEA ตัดรอบ (ไม่ใช่แค่เที่ยงคืนแบบ offset ของ utility_meter เปล่าๆ)

ทำตามลำดับนี้ **ห้ามสลับขั้นตอน** เพราะ automation ในขั้นที่ 3 ต้องอ้างถึง entity ที่สร้างในขั้นที่ 1-2 ก่อน

## ขั้นที่ 1 — สร้าง Utility Meter Helper (4 ตัว)

Settings → Devices & services → แท็บ **Helpers** → **+ Create helper** → **Utility Meter**

สร้างทีละตัว โดย **Input sensor** ให้เลือก sensor มิเตอร์ดิบของจริง (ตัวที่ไล่ขึ้นตลอดไม่รีเซ็ตเอง เช่นจาก ESP32/PZEM):

| Name ที่ตั้ง | Input sensor | Meter reset cycle |
|---|---|---|
| Daily Grid | sensor มิเตอร์กริดดิบ | **Daily** |
| Daily Load | sensor มิเตอร์โหลดดิบ | **Daily** |
| Monthly Grid | sensor มิเตอร์กริดดิบ (ตัวเดิม) | **Monthly** (ไว้ก่อน — จะกลับมาแก้ในขั้นที่ 2) |
| Monthly Load | sensor มิเตอร์โหลดดิบ (ตัวเดิม) | **Monthly** (ไว้ก่อน — จะกลับมาแก้ในขั้นที่ 2) |

## ขั้นที่ 2 — แก้ cycle ของ "Monthly Grid/Load" เป็น Yearly

⚠️ **ห้ามข้ามขั้นนี้** ไม่งั้น utility_meter จะ auto-reset เองตอนเที่ยงคืนวันที่ 1 ซ้อนกับ automation ที่จะสร้างในขั้นที่ 4 — กลายเป็นรีเซ็ต 2 รอบ ข้อมูลเพี้ยน

ไปที่ **Monthly Grid** และ **Monthly Load** ทีละตัว → คลิกชื่อ entity → กดปุ่มตั้งค่า (เฟือง) → เปลี่ยน **Meter reset cycle จาก Monthly เป็น Yearly** → บันทึก

(เลือก Yearly เพราะแทบไม่มีวันชน — ปล่อยให้ automation ในขั้นที่ 4 เป็นคนสั่งรีเซ็ตทุกเดือนแทนทั้งหมด)

## ขั้นที่ 3 — สร้าง Input Number Helper (2 ตัว)

Settings → Devices & services → Helpers → **+ Create helper** → **Number**

| Name | Entity ID | Min | Max | ค่าเริ่มต้น |
|---|---|---|---|---|
| PEA Cutoff Day | `input_number.pea_cutoff_day` | 1 | 31 | วันที่ตัดรอบจริง (ดูจากใบแจ้งหนี้ PEA) |
| PEA Cutoff Hour | `input_number.pea_cutoff_hour` | 0 | 23 | ชั่วโมงที่ตัดรอบจริง |

ตั้งเป็น input_number (ไม่ใช่ค่าคงที่ในโค้ด) เพื่อให้แก้วันตัดรอบทีหลังได้จากหน้า UI โดยไม่ต้องยุ่งกับ automation อีก

## ขั้นที่ 4 — สร้าง Automation สั่งรีเซ็ตตรงเวลาจริง

Settings → Automations & scenes → **Create Automation** → กด `⋮` มุมขวาบน → **Edit in YAML** → วางทับด้วยอันนี้:

```yaml
alias: "Reset PEA billing cycle"
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

เช็คทุก 5 นาที พอวัน+ชั่วโมงตรงกับค่าใน input_number ทั้งสองตัว จะยิง `utility_meter.reset` ให้ Monthly Grid/Load ทั้งคู่ครั้งเดียว (`minute < 5` กันยิงซ้ำหลายครั้งในชั่วโมงเดียวกัน)

## ขั้นที่ 5 — ตั้งค่า Bill Energy Card

เอา entity ที่ได้จากขั้นที่ 1 (Daily) และขั้นที่ 1-2 (Monthly ที่เปลี่ยนเป็น Yearly cycle แล้ว แต่ใช้ชื่อ entity เดิม) ไปกรอกในการ์ด:

```yaml
type: custom:bill-energy-card
grid_entity_daily: sensor.smartmeter_2_phase_daily_grid
load_entity_daily: sensor.smartmeter_2_phase_daily_load
grid_entity_cycle: sensor.smartmeter_2_phase_monthly_grid
load_entity_cycle: sensor.smartmeter_2_phase_monthly_load
```

## หมายเหตุ

- ต้องรอให้ automation ยิง reset ผ่านไปอย่างน้อย **1 ครั้ง** (1 รอบบิล) ก่อนการ์ดจะมีข้อมูลให้แสดงในมุมมองรายเดือน (การ์ดตรวจจับรอบจากค่าที่ตกกะทันหันในประวัติ ถ้ายังไม่เคย reset เลยจะไม่มีจุดให้ตรวจจับ)
- มุมมองรายวันใช้งานได้ทันทีตั้งแต่วันที่ 2 ที่ติดตั้ง (utility_meter cycle: Daily ไม่ต้องรอ automation)
- ถ้าจะเปลี่ยนวันตัดรอบในอนาคต แก้แค่ `input_number.pea_cutoff_day`/`pea_cutoff_hour` จากหน้า UI พอ ไม่ต้องแก้ automation
