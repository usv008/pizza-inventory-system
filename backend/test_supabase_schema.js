require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testSchemaFix() {
  console.log('🔧 Testing Supabase schema fixes...\n');
  
  try {
    // Test 1: Try to insert a stock movement with new fields
    console.log('📝 Test 1: Inserting stock movement with new fields...');
    const { data: insertData, error: insertError } = await supabase
      .from('stock_movements')
      .insert({
        product_id: 1,
        movement_type: 'IN',
        quantity: 10,
        pieces: 50,
        boxes: 5,
        user: 'migration_test',
        reason: 'Schema fix test'
      })
      .select()
      .single();
    
    if (insertError) {
      console.log('❌ Insert failed:', insertError.message);
      if (insertError.message.includes('row-level security')) {
        console.log('🔒 RLS still blocking - need to fix policies');
      }
      if (insertError.message.includes('column') && insertError.message.includes('does not exist')) {
        console.log('📋 Missing columns - need to add fields to schema');
      }
    } else {
      console.log('✅ Insert successful! Record ID:', insertData.id);
    }
    
    // Test 2: Try to read stock movements
    console.log('\n📖 Test 2: Reading stock movements...');
    const { data: selectData, error: selectError } = await supabase
      .from('stock_movements')
      .select('*')
      .limit(3);
    
    if (selectError) {
      console.log('❌ Select failed:', selectError.message);
    } else {
      console.log('✅ Select successful! Records found:', selectData.length);
      if (selectData.length > 0) {
        console.log('📋 Sample record fields:', Object.keys(selectData[0]));
      }
    }
    
    // Test 3: Check if new fields exist
    console.log('\n🔍 Test 3: Checking table structure...');
    const { data: structureData, error: structureError } = await supabase
      .from('stock_movements')
      .select('id, pieces, boxes, user')
      .limit(1);
    
    if (structureError) {
      console.log('❌ Structure check failed:', structureError.message);
      if (structureError.message.includes('column') && structureError.message.includes('does not exist')) {
        console.log('🚨 SCHEMA FIX NEEDED: Fields pieces, boxes, user not found');
      }
    } else {
      console.log('✅ New fields accessible!');
    }
    
  } catch (error) {
    console.log('❌ Test failed with error:', error.message);
  }
}

testSchemaFix().catch(console.error);
