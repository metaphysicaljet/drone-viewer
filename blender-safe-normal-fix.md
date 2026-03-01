# Safe Blender Normal Fix Script

This script includes safety checks and diagnostics before making any changes.

## 🛡️ Safety Features:

- ✅ Analyzes your model BEFORE making changes
- ✅ Shows exactly which objects will be modified
- ✅ Only touches objects with flipped normals
- ✅ Preserves correctly oriented faces
- ✅ Non-destructive (your .blend file remains intact until you save)
- ✅ Validates the fix after applying

---

## 📋 Step 1: Run Diagnostic First

Copy and paste this into Blender's Python Console to see what will be fixed:

```python
import bpy
import bmesh

def diagnose_normals():
    """Check which objects have flipped normals"""
    print("\n" + "="*70)
    print("🔍 DIAGNOSTIC SCAN - NO CHANGES WILL BE MADE")
    print("="*70 + "\n")
    
    mesh_objects = [obj for obj in bpy.data.objects if obj.type == 'MESH']
    
    if not mesh_objects:
        print("❌ No mesh objects found in scene")
        return []
    
    print(f"📊 Scanning {len(mesh_objects)} mesh objects...\n")
    print(f"{'Object Name':<30} {'Faces':<8} {'Status':<15} {'Flipped'}")
    print("-" * 70)
    
    problem_objects = []
    total_faces = 0
    total_flipped = 0
    
    for obj in mesh_objects:
        bm = bmesh.new()
        bm.from_mesh(obj.data)
        bm.faces.ensure_lookup_table()
        
        face_count = len(bm.faces)
        total_faces += face_count
        flipped_count = 0
        
        if face_count > 0:
            # Check for inconsistent normals
            for face in bm.faces:
                # Check if face normal points inward (negative Z in general)
                if face.normal.length > 0:
                    # Compare with average to detect flipped faces
                    avg_normal = sum((f.normal for f in bm.faces), face.normal.copy() * 0)
                    if avg_normal.length > 0:
                        avg_normal.normalize()
                        if face.normal.dot(avg_normal) < -0.3:
                            flipped_count += 1
        
        status = "⚠️  NEEDS FIX" if flipped_count > face_count * 0.1 else "✅ OK"
        flipped_pct = f"{(flipped_count/face_count*100):.1f}%" if face_count > 0 else "0%"
        
        print(f"{obj.name:<30} {face_count:<8} {status:<15} {flipped_count} ({flipped_pct})")
        
        if flipped_count > face_count * 0.1:
            problem_objects.append(obj.name)
            total_flipped += flipped_count
        
        bm.free()
    
    print("-" * 70)
    print(f"\n📋 SUMMARY:")
    print(f"   Total objects: {len(mesh_objects)}")
    print(f"   Objects needing fix: {len(problem_objects)}")
    print(f"   Total faces: {total_faces}")
    print(f"   Estimated flipped faces: {total_flipped}")
    
    if problem_objects:
        print(f"\n⚠️  OBJECTS THAT WILL BE MODIFIED:")
        for i, obj_name in enumerate(problem_objects, 1):
            print(f"   {i}. {obj_name}")
        print(f"\n💡 These {len(problem_objects)} objects will have their normals recalculated.")
        print(f"   All other objects will remain UNCHANGED.")
    else:
        print("\n✅ No fixes needed! All normals are correctly oriented.")
    
    print("\n" + "="*70 + "\n")
    
    return problem_objects

# Run the diagnostic
problem_objects = diagnose_normals()
```

---

## 🔧 Step 2: Apply the Fix (Only After Reviewing Diagnostic)

**IMPORTANT:** Only run this after reviewing the diagnostic output above!

```python
import bpy
import bmesh

def safe_fix_normals():
    """Safely fix only objects with flipped normals"""
    
    # Re-run diagnostic to get list of problem objects
    print("\n" + "="*70)
    print("🔧 SAFE NORMAL FIX - STARTING")
    print("="*70 + "\n")
    
    mesh_objects = [obj for obj in bpy.data.objects if obj.type == 'MESH']
    problem_objects = []
    
    # Identify problem objects
    for obj in mesh_objects:
        bm = bmesh.new()
        bm.from_mesh(obj.data)
        bm.faces.ensure_lookup_table()
        
        face_count = len(bm.faces)
        flipped_count = 0
        
        if face_count > 0:
            for face in bm.faces:
                if face.normal.length > 0:
                    avg_normal = sum((f.normal for f in bm.faces), face.normal.copy() * 0)
                    if avg_normal.length > 0:
                        avg_normal.normalize()
                        if face.normal.dot(avg_normal) < -0.3:
                            flipped_count += 1
        
        if flipped_count > face_count * 0.1:
            problem_objects.append(obj.name)
        
        bm.free()
    
    if not problem_objects:
        print("✅ No objects need fixing!")
        print("="*70 + "\n")
        return
    
    print(f"🎯 Will fix {len(problem_objects)} objects\n")
    
    # Deselect all first
    bpy.ops.object.select_all(action='DESELECT')
    
    fixed_count = 0
    skipped = []
    
    # Fix each problem object
    for obj_name in problem_objects:
        obj = bpy.data.objects.get(obj_name)
        
        if obj and obj.type == 'MESH':
            print(f"🔧 Fixing: {obj_name}")
            
            # Select and activate the object
            obj.select_set(True)
            bpy.context.view_layer.objects.active = obj
            
            # Enter edit mode
            bpy.ops.object.mode_set(mode='EDIT')
            
            # Select all faces
            bpy.ops.mesh.select_all(action='SELECT')
            
            # Recalculate normals outside (this is the fix!)
            bpy.ops.mesh.normals_make_consistent(inside=False)
            
            # Exit edit mode
            bpy.ops.object.mode_set(mode='OBJECT')
            
            # Deselect
            obj.select_set(False)
            
            fixed_count += 1
            print(f"   ✅ Fixed!")
        else:
            skipped.append(obj_name)
            print(f"   ⚠️  Skipped (not found or not mesh)")
    
    # Summary
    print("\n" + "="*70)
    print("✅ FIX COMPLETE!")
    print("="*70)
    print(f"✅ Fixed: {fixed_count} objects")
    if skipped:
        print(f"⚠️  Skipped: {len(skipped)} objects")
    
    print("\n🔍 Validating fix...")
    
    # Validate: re-check for flipped normals
    validation_issues = 0
    for obj_name in problem_objects:
        obj = bpy.data.objects.get(obj_name)
        if obj and obj.type == 'MESH':
            bm = bmesh.new()
            bm.from_mesh(obj.data)
            bm.faces.ensure_lookup_table()
            
            flipped = 0
            for face in bm.faces:
                if face.normal.length > 0:
                    avg_normal = sum((f.normal for f in bm.faces), face.normal.copy() * 0)
                    if avg_normal.length > 0:
                        avg_normal.normalize()
                        if face.normal.dot(avg_normal) < -0.3:
                            flipped += 1
            
            if flipped > len(bm.faces) * 0.05:  # Allow 5% tolerance
                validation_issues += 1
                print(f"   ⚠️  {obj_name} still has issues")
            
            bm.free()
    
    if validation_issues == 0:
        print("   ✅ All objects validated successfully!")
    else:
        print(f"   ⚠️  {validation_issues} objects may still have issues")
    
    print("\n💾 NEXT STEPS:")
    print("   1. Visually inspect your model (rotate view, check for holes)")
    print("   2. If looks good: File → Export → glTF 2.0 (.glb)")
    print("   3. Replace public/drone.glb with new export")
    print("   4. Test in your viewer")
    print("   5. If issues: Ctrl+Z to undo, or reload your .blend file")
    
    print("\n" + "="*70 + "\n")

# Run the fix
safe_fix_normals()
```

---

## 📖 How to Use This Script:

### **Step-by-Step Instructions:**

1. **Open Blender** with your drone model loaded

2. **Switch to Scripting workspace** (top menu bar)

3. **Open Python Console** (bottom panel, or View → Sidebar → Python Console)

4. **FIRST: Run the Diagnostic**
   - Copy the **Step 1 diagnostic code**
   - Paste into Python Console (Ctrl+V)
   - Press Enter
   - **Review the output** - it will show which objects will be modified

5. **THEN: Apply the Fix (only if diagnostic looks good)**
   - Copy the **Step 2 fix code**
   - Paste into Python Console
   - Press Enter
   - Script will fix the problematic objects

6. **Verify the results**
   - Rotate your 3D view and inspect the model
   - Look for any deformations or issues
   - If anything looks wrong, press **Ctrl+Z** to undo

7. **Export your model**
   - File → Export → glTF 2.0 (.glb/.gltf)
   - Save as `drone.glb` to your Downloads folder
   - Replace `public/drone.glb` in your project

---

## 🛡️ Safety Guarantees:

### **What This Script WILL Do:**
- ✅ Only modify objects with >10% flipped faces
- ✅ Recalculate normals to point outward correctly
- ✅ Keep all geometry, vertices, and UVs intact
- ✅ Preserve materials and textures
- ✅ Maintain object hierarchy and parenting

### **What This Script WON'T Do:**
- ❌ Won't delete or add geometry
- ❌ Won't modify vertex positions
- ❌ Won't change materials or textures
- ❌ Won't affect objects with correct normals
- ❌ Won't modify UV maps or vertex colors
- ❌ Won't change object transforms or animations

### **How "Recalculate Normals Outside" Works:**

This is a **safe, standard Blender operation** that:
1. Analyzes each face's orientation
2. Flips normals that point inward
3. Makes all faces point consistently outward
4. Does **NOT** alter geometry or shape

It's equivalent to:
- Edit Mode → Select All → Mesh → Normals → Recalculate Outside (Shift+N)

---

## ❓ FAQ:

**Q: Will this change my drone's shape?**  
A: No. It only changes which direction faces point, not their position or shape.

**Q: What if something goes wrong?**  
A: Press Ctrl+Z immediately, or reload your .blend file without saving.

**Q: Can I undo this?**  
A: Yes! The script doesn't save automatically. You can undo with Ctrl+Z or reload your file.

**Q: Should I save before running this?**  
A: Good idea! File → Save As → give it a backup name like `drone_backup.blend`

**Q: Why not just use DoubleSide in Three.js?**  
A: That works but doubles rendering cost. Fixing normals properly is more efficient.

---

## 🎯 Expected Results:

After running this script:
- ✅ Objects visible from all angles in Three.js
- ✅ No need for `side={THREE.DoubleSide}`
- ✅ Better performance (50% fewer faces rendered for fixed objects)
- ✅ Proper backface culling works
- ✅ Model looks identical but renders correctly

---

## 🔍 Still Concerned?

If you want to be extra careful:
1. Save your current .blend as `drone_backup.blend`
2. Run the diagnostic only (Step 1)
3. Review which objects will be modified
4. If you're happy with the list, run Step 2
5. Visually inspect in Blender's viewport
6. Test export a small version first

**Remember:** The fix is completely reversible by reloading your original .blend file!
